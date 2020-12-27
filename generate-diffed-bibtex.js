
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

    allFields = allFields.filter(field => !presentFields.includes(field));
    presentFields.reverse().forEach(field => allFields.splice(lowestIndex, 0, field));
    return allFields;
}

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified, parentElem) {
    let table = $(document.createElement("table"))
        .addClass("result")
        .addClass(`table-id-${modified.citationKey}`);

    parentElem.append(acceptChangeRadio(table));
    parentElem.append(clearfix());
    parentElem.append(table);

    const modifiedClass = "table-row-modified";

    // Entry type
    if (modified.entryType == orig.entryType) {
        table.append(rowWithText(`@${modified.entryType}{${modified.citationKey}${entrysep}`));
    } else {
        let origLine = `@${orig.entryType}{${modified.citationKey}${entrysep}`;
        let modLine = `@${modified.entryType}{${modified.citationKey}${entrysep}`;
        let entryElems = doDiffLine(origLine, modLine, ["table-row-field-bibtextype", modifiedClass]);
        entryElems.forEach(function(entry) {
            addStrikeEvents(entry, entryElems);
            table.append(entry);
        });
    }

    if (modified.entry) {
        table.append(rowWithText(modified.entry));
    }

    let modIdx = 0;
    let origIdx = 0;
    // Order that we should have the fields in when rendering the bibtex
    let fieldOrder = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);

    // Force the field order for aesthetics
    const dateFieldOrder = ["date", "year", "month"];
    fieldOrder = enforceFieldOrder(fieldOrder, dateFieldOrder);
    fieldOrder = enforceFieldOrder(fieldOrder, ["journaltitle", "booktitle", "publisher"]);

    let shouldDate = false;
    if (fieldOrder.includes("date") && fieldOrder.includes("year")) {
        // i'm so sorry
        if (fieldOrder.includes("month")) {
            shouldDate = "month";
        } else {
            shouldDate = "year";
        }
    } 

    // actually do it 
    let dateFields = []; // this hackery relies on the ordering of (date, month, year) enforced above
    let fieldToElementMapping = {};
    for (let field of fieldOrder) {
        let fieldClass = `table-row-field-${field}`;
        let fieldHasModification = true;
        let tableElements = [];

        if (field in modified.entryTags && field in orig.entryTags) {
            // Field isn't new, but may or may not be modified 
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                fieldHasModification = false;
                tableElements.push(rowWithText(textForField(field, modEntry)));
            } else {
                let modifiedText = textForField(field, modEntry);
                let origText = textForField(field, origEntry);
                let entryElems = doDiffLine(origText, modifiedText, [fieldClass, modifiedClass]);
                tableElements.push(...entryElems);
            }
        } else if (field in modified.entryTags) {
            // Field is a new one  
            let addedText = textForField(field, modified.entryTags[field]);
            let addedElem = rowWithText(addedText, [diffClasses["added"]["bg"], fieldClass, modifiedClass]);
            tableElements.push(addedElem);
        } else {
            // Field is being removed
            let removedText = textForField(field, orig.entryTags[field]);
            let removedElem = rowWithText(removedText, [diffClasses["removed"]["bg"], fieldClass, modifiedClass]);
            tableElements.push(removedElem);
        }

        tableElements.forEach(element => table.append(element));
        if (fieldHasModification) {
            fieldToElementMapping[field] = tableElements; 
        }
    }

    // Fields which should be toggled together. Currently only date fields.
    let toggleTogetherFields = [];

    let presentDateFields = dateFieldOrder.filter(field => field in fieldToElementMapping); 
    if (presentDateFields.length > 1) {
        toggleTogetherFields.push(presentDateFields);
    }

    for (let toggleTogetherFieldSet of toggleTogetherFields) {
        let previousFieldElements = {};
        for (let field of toggleTogetherFieldSet) {
            previousFieldElements[field] = [...fieldToElementMapping[field]];
        }
        for (let sourceField of toggleTogetherFieldSet) {
            for (let originField of toggleTogetherFieldSet) {
                if (sourceField == originField) {
                    continue;
                }
                fieldToElementMapping[sourceField].push(...previousFieldElements[originField])
            }
        }
    }

    // Add event handlers to strike out text
    for (let tableElements of Object.values(fieldToElementMapping)) {
        tableElements.forEach(element => addStrikeEvents(element, tableElements)); 
    }

    table.append(rowWithText("}"));
    return parentElem;
}

const indent = "        ";
const entrysep = ",";
function textForField(field, value) {
    return `${indent}${field} = {${value}}${entrysep}`
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

