
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

function enforceFieldOrder(allFields, rearrangeFields) {
    // Enforces the order of the rearrangeFields as given,
    // at the position of the first-occurring one.
    let presentFields = rearrangeFields.filter(field => allFields.includes(field));

    if (presentFields.length <= 1) {
        return allFields;
    }

    let fieldIdxs = presentFields.map(field => allFields.indexOf(field));
    let lowestIndex = Math.min(...fieldIdxs);
    console.log(allFields);
    allFields = allFields.filter(field => !presentFields.includes(field));
    console.log(allFields);
    presentFields.reverse().forEach(field => allFields.splice(lowestIndex, 0, field));
    console.log(allFields);
    return allFields;
}

const indent = "        ";
/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified, parentElem) {
    let tableElem = $(document.createElement("table"));
    tableElem.addClass("result");
    tableElem.addClass(`table-id-${modified.citationKey}`);

    parentElem.append(acceptChangeRadio(tableElem));
    parentElem.append(clearfix());
    parentElem.append(tableElem);

    const entrysep = ",";
    const modifiedClass = "table-row-modified";

    // Entry type
    if (modified.entryType == orig.entryType) {
        tableElem.append(rowWithText(`@${modified.entryType}{${modified.citationKey}${entrysep}`));
    } else {
        let origLine = `@${orig.entryType}{${modified.citationKey}${entrysep}`;
        let modLine = `@${modified.entryType}{${modified.citationKey}${entrysep}`;
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
    let fieldOrder = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    // This is really just for aesthetics
    let shouldDate = false;
    if (fieldOrder.includes("date") && fieldOrder.includes("year")) {
        // i'm so sorry
        if (fieldOrder.includes("month")) {
            shouldDate = "month";
        } else {
            shouldDate = "year";
        }
    //    fieldOrder = fieldOrder.filter(tag => tag != "year" && tag != "month");
      //  let dateIndex = fieldOrder.indexOf("date") + 1;
        if (shouldDate == "month") {
  //          fieldOrder.splice(dateIndex, 0, "month");
        }
//        fieldOrder.splice(dateIndex, 0, "year");
    }
    fieldOrder = enforceFieldOrder(fieldOrder, ["date", "year", "month"]);
    fieldOrder = enforceFieldOrder(fieldOrder, ["journaltitle", "booktitle", "publisher"]);

    // actually do it 
    let numFieldsAdded = 0;
    let dateFields = []; // this hackery relies on the ordering of (date, month, year) enforced above
    for (let field of fieldOrder) {
        let fieldClass = `table-row-field-${field}`;
        let isLastField = fieldOrder.length == numFieldsAdded + 1;
        let suffix = isLastField ? "" : entrysep;

        if (field in modified.entryTags && field in orig.entryTags) {
            // Field isn't new, but may or may not be modified 
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                let addedText = textForField(field, modEntry, suffix);
                tableElem.append(rowWithText(addedText));
            } else {
                let modAdded = textForField(field, modEntry, suffix);
                let origAdded = textForField(field, origEntry, suffix);
                let entryElems = doDiffLine(origAdded, modAdded, [fieldClass, modifiedClass]);
                entryElems.forEach(function(entry) {
                    addStrikeEvents(entry, entryElems);
                    tableElem.append(entry);
                });
            }
        } else if (field in modified.entryTags) {
            // Field is a new one  
            let addedText = textForField(field, modified.entryTags[field], suffix);
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
            // Field is being removed
            let removedText = textForField(field, orig.entryTags[field], suffix);
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

function textForField(field, value, suffix) {
    return `${indent}${field} = {${value}}${suffix}`
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
    $("button.download-button").prop("disabled", allTablesHidden() || allVisFieldsHidden());
}

function unhideTable(table) {
    table.removeClass("hidden-table");
    $("button.download-button").prop("disabled", allVisFieldsHidden());
}

/*function diffedSpan(pre, changed, post, highlight_clazz, whole_clazz) {
    let parentSpan = $(document.createElement("span"));
    parentSpan.append(spanWithText(pre));
    parentSpan.append(spanWithText(changed, highlight_clazz));
    parentSpan.append(spanWithText(post));
    parentSpan.addClass(whole_clazz);
    return parentSpan;
}*/

function spanWithText(text, clazz) {
    return $(document.createElement("span")).text(text).addClass(clazz);
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

