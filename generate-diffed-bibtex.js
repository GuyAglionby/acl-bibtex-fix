
// ########################################## 
// # Render diffs 
// ########################################## 

function strikeHoverEnter(elems) {
    let strike;
    if (elems[0].hasClass("field-disabled")) {
        strike = "field-disabled-hover-remove";
    } else {
        strike = "field-disabled-hover";
    }
    elems.forEach((elem) => {
        elem.addClass(strike);
    });
}

function strikeHoverLeave(elems) {
    elems.forEach((elem) => {
        elem.removeClass("field-disabled-hover-remove");
        elem.removeClass("field-disabled-hover");
    });
}

function strike(elems) {
    const strike = "field-disabled";
    elems.forEach((elem) => {
        if (elem.hasClass(strike)) {
            elem.removeClass(strike);
            if (!allTablesHidden()) {
                $("button.download-button").prop("disabled", false);
            }
        } else {
            elem.addClass(strike);
            if (allVisFieldsHidden()) {
                $("button.download-button").prop("disabled", true);
            }
            if (allVisFieldsHiddenForTable(elem.parent())) {
                elem.parent().parent().find(".btn-outline-danger").click()
            }
        }
        elem.removeClass("field-disabled-hover-remove");
        elem.removeClass("field-disabled-hover");
    });
}

function addStrikeEvents(elem, actionElems) {
    // XXX hack - addStrikeEvents is called twice for date-type fields,
    // which breaks things. Fix that, then remove the below.
    elem.unbind()
    elem.click(() => strike(actionElems));
    elem.mouseenter(() => strikeHoverEnter(actionElems));
    elem.mouseleave(() => strikeHoverLeave(actionElems));
}

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified, parentElem) {
    let tableElem = $(document.createElement("table"));
    tableElem.addClass("result");
    tableElem.addClass("table-id-" + modified.citationKey);

    parentElem.append(acceptChangeRadio(tableElem));
    parentElem.append(clearfix());
    parentElem.append(tableElem);

    const entrysep = ",";
    const indent = "        ";
    const modifiedClass = "table-row-modified";

    if (modified.entryType == orig.entryType) {
        tableElem.append(rowWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origLine = "@" + orig.entryType + "{" + modified.citationKey + entrysep;
        let modLine = "@" + modified.entryType + "{" + modified.citationKey + entrysep;
        let entryElems = doDiffLine(origLine, modLine, ["table-row-field-bibtextype", modifiedClass]);
        entryElems.forEach(function(entry) {
            addStrikeEvents(entry, entryElems);
            tableElem.append(entry);
        });
    }

    if (modified.entry) {
        tableElem.append(rowWithText(modified.entry));
    }

    let modIdx = 0;
    let origIdx = 0;
    // Order that we should have the fields in when rendering the bibtex
    let tagSeq = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    // This is really just for aesthetics
    let shouldDate = false;
    if (tagSeq.includes("date") && tagSeq.includes("year")) {
        // i'm so sorry
        if (tagSeq.includes("month")) {
            shouldDate = "month";
        } else {
            shouldDate = "year";
        }
        tagSeq = tagSeq.filter(tag => tag != "year" && tag != "month");
        let dateIndex = tagSeq.indexOf("date") + 1;
        if (shouldDate == "month") {
            tagSeq.splice(dateIndex, 0, "month");
        }
        tagSeq.splice(dateIndex, 0, "year");
    }
    if (tagSeq.includes("booktitle") && tagSeq.includes("journaltitle")) {
        let first = tagSeq.indexOf("booktitle") < tagSeq.indexOf("journaltitle") ? "booktitle" : "journaltitle";
        let second = first == "booktitle" ? "journaltitle" : "booktitle";
        tagSeq = tagSeq.filter(tag => tag != second);
        let dateIndex = tagSeq.indexOf(first) + 1;
        tagSeq.splice(dateIndex, 0, second);
    }
    if (tagSeq.includes("booktitle") && tagSeq.includes("publisher")) {
        tagSeq = tagSeq.filter(tag => tag != "publisher");
        let dateIndex = tagSeq.indexOf("booktitle") + 1;
        tagSeq.splice(dateIndex, 0, "publisher");
    }

    // actually do it 
    let numFieldsAdded = 0;
    let dateFields = []; // this hackery relies on the ordering of (date, month, year) enforced above
    for (let field of tagSeq) {
        let fieldClass = "table-row-field-" + field;
        let shouldComma = tagSeq.length != numFieldsAdded + 1;
        if (field in modified.entryTags && field in orig.entryTags) {
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                let addedText = indent + field + " = {" + modEntry + "}";
                addedText += shouldComma ? "," : "";
                tableElem.append(rowWithText(addedText));
            } else {
                let modAdded = indent + field + " = {" + modEntry + "}";
                modAdded += shouldComma ? "," : "";
                let origAdded = indent + field + " = {" + origEntry + "}";
                origAdded += shouldComma ? "," : "";
                let entryElems = doDiffLine(origAdded, modAdded, [fieldClass, modifiedClass]);
                entryElems.forEach(function(entry) {
                    addStrikeEvents(entry, entryElems);
                    tableElem.append(entry);
                });
            }
        } else if (field in modified.entryTags) {
            let addedText = indent + field + " = {" + modified.entryTags[field] + "}";
            addedText += shouldComma ? "," : "";
            let addedElem = rowWithText(addedText, [diffClasses["added"]["bg"], fieldClass, modifiedClass]);
            addStrikeEvents(addedElem, [addedElem]);
            if (shouldDate && (field == "month" || field == "year")) {
                dateFields.push(addedElem);
                if (field == shouldDate) {
                    dateFields.forEach((df) => {
                        addStrikeEvents(df, dateFields);
                        tableElem.append(df);
                    })
                }
            } else {
                tableElem.append(addedElem);
            }
        } else {
            let removedText = indent + field + " = {" + orig.entryTags[field] + "}";
            removedText += shouldComma ? "," : "";
            let removedElem = rowWithText(removedText, [diffClasses["removed"]["bg"], fieldClass, modifiedClass]);
            addStrikeEvents(removedElem, [removedElem]);
            if (shouldDate && field == "date") {
                dateFields.push(removedElem);
            } else {
                tableElem.append(removedElem);
            }
        }
        numFieldsAdded += 1;
    }
    tableElem.append(rowWithText("}"));
    return parentElem;
}


// ########################################## 
// # Helper functions for random text 
// ########################################## 

function clearfix() {
    return $(document.createElement("div")).addClass("clearfix");
}

function changeIofN(i, n) {
    return $(document.createElement("p")).addClass("change-i-of-n").text("Change " + i + "/" + n);
}

function acceptChangeRadio(relatedTable) {
    let parentE = $(document.createElement("div"));
    parentE.addClass("accept-change-radio");
    parentE.html(`<div class="btn-group btn-group-toggle" data-toggle="buttons">
  <label class="btn btn-outline-success btn-sm active">
    <input type="radio" name="options" id="option1" checked> Accept
  </label>
  <label class="btn btn-outline-danger btn-sm">
    <input type="radio" name="options" id="option2"> Reject 
  </label>
</div>`);
    parentE.find(".btn-outline-success").click(() => unhideTable(relatedTable));
    parentE.find(".btn-outline-danger").click(() => hideTable(relatedTable));
    return parentE;
}

// ########################################## 
// # Helper functions for rendering diffs 
// ########################################## 

function allTablesHidden() {
    return $("table.hidden-table").length == $("table.result").length;
}

function allVisFieldsHidden() {
    return $("table.result:not(.hidden-table) tr.table-row-modified").length == $("table.result:not(.hidden-table) tr.table-row-modified.field-disabled").length;
}

function allVisFieldsHiddenForTable(table) {
    return $(table).children("tr.table-row-modified").length == $(table).children("tr.table-row-modified.field-disabled").length;
}

function hideTable(table) {
    table.addClass("hidden-table");
    if (allTablesHidden()) {
        $("button.download-button").prop("disabled", true);
    } else if (allVisFieldsHidden()) {
        $("button.download-button").prop("disabled", true);
    }
}

function unhideTable(table) {
    table.removeClass("hidden-table");
    if (!allVisFieldsHidden()) {
        $("button.download-button").prop("disabled", false);
    }
}

function diffedSpan(pre, changed, post, highlight_clazz, whole_clazz) {
    let parentSpan = $(document.createElement("span"));
    parentSpan.append(spanWithText(pre));
    parentSpan.append(spanWithText(changed, highlight_clazz));
    parentSpan.append(spanWithText(post));
    parentSpan.addClass(whole_clazz);
    return parentSpan;
}

function spanWithText(text, clazz) {
    let s = $(document.createElement("span"));
    s.text(text);
    s.addClass(clazz);
    return s;
}

function rowWithText(text, clazz) {
    return rowWithElem(spanWithText(text), clazz);
}

function rowWithElem(elem, clazz) {
    let row = $(document.createElement("tr")).addClass(clazz);
    let cell = $(document.createElement("td")).append(elem);
    row.append(cell);
    return row;
}

function makeDiffLineElem(diff, prop, clazz) {
    let origE = $(document.createElement("span"));
    diff.forEach((part) => {
        if (!part.added && !part.removed) {
            origE.append(spanWithText(part.value));
        } else if (part[prop]) {
            origE.append(spanWithText(part.value, diffClasses[prop]["text"]));
        }
    });
    let row = rowWithElem(origE, diffClasses[prop]["bg"]);
    row.addClass(clazz);
    return row;
}

function doDiffLine(origLine, modLine, clazz) {
    let diff = Diff.diffWords(origLine, modLine);
    let elems = [];
    elems.push(makeDiffLineElem(diff, "removed", clazz));
    elems.push(makeDiffLineElem(diff, "added", clazz));
    return elems;
}

