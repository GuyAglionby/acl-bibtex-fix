
// ########################################## 
// # Render diffs 
// ########################################## 

function strikeHoverEnter(elems) {
    let strike;
    if (elems[0].classList.contains('field-disabled')) {
        strike = 'field-disabled-hover-remove';
    } else {
        strike = 'field-disabled-hover';
    }
    elems.forEach((elem) => {
        elem.classList.add(strike);
    });
}

function strikeHoverLeave(elems) {
    elems.forEach((elem) => {
        elem.classList.remove('field-disabled-hover-remove');
        elem.classList.remove('field-disabled-hover');
    });
}

function strike(elems) {
    const strike = 'field-disabled';
    elems.forEach((elem) => {
        if (elem.classList.contains(strike)) {
            elem.classList.remove(strike);
            if (!allTablesHidden()) {
                $('button.download-button').prop('disabled', false);
            }
        } else {
            elem.classList.add(strike);
            if (allVisFieldsHidden()) {
                $('button.download-button').prop('disabled', true);
            }
            let tableParent = elem.parentNode;
            if (allVisFieldsHiddenForTable(tableParent)) {
                $(tableParent.parentNode).find('.btn-outline-danger').click()
            }
        }
        elem.classList.remove('field-disabled-hover-remove');
        elem.classList.remove('field-disabled-hover');
    });
}

function addStrikeEvents(elem, actionElems) {
    elem.onclick = () => strike(actionElems);
    elem.onmouseenter = () => strikeHoverEnter(actionElems);
    elem.onmouseleave = () => strikeHoverLeave(actionElems);
}

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified, parentElem) {
    let tableElem = document.createElement('table');
    tableElem.classList.add('result');
    tableElem.classList.add('table-id-' + modified.citationKey);

    parentElem.appendChild(acceptChangeRadio(tableElem));
    parentElem.appendChild(clearfix());
    parentElem.appendChild(tableElem);

    const entrysep = ',';
    const indent = '        ';
    const modifiedClass = 'table-row-modified';

    if (modified.entryType == orig.entryType) {
        tableElem.appendChild(rowWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origLine = "@" + orig.entryType + "{" + modified.citationKey + entrysep;
        let modLine = "@" + modified.entryType + "{" + modified.citationKey + entrysep;
        let entryElems = doDiffLine(origLine, modLine, ['table-row-field-bibtextype', modifiedClass]);
        entryElems.forEach(function(entry) {
            addStrikeEvents(entry, entryElems);
            tableElem.appendChild(entry);
        });
    }

    if (modified.entry) {
        tableElem.appendChild(rowWithText(modified.entry));
    }

    let modIdx = 0;
    let origIdx = 0;
    // Order that we should have the fields in when rendering the bibtex
    let tagSeq = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    // This is really just for aesthetics
    let shouldDate = false;
    if (tagSeq.includes('date') && tagSeq.includes('year')) {
        // i'm so sorry
        if (tagSeq.includes('month')) {
            shouldDate = 'month';
        } else {
            shouldDate = 'year';
        }
        tagSeq = tagSeq.filter(tag => tag != 'year' && tag != 'month');
        let dateIndex = tagSeq.indexOf('date') + 1;
        if (shouldDate == 'month') {
            tagSeq.splice(dateIndex, 0, 'month');
        }
        tagSeq.splice(dateIndex, 0, 'year');
    }
    if (tagSeq.includes('booktitle') && tagSeq.includes('journaltitle')) {
        let first = tagSeq.indexOf('booktitle') < tagSeq.indexOf('journaltitle') ? 'booktitle' : 'journaltitle';
        let second = first == 'booktitle' ? 'journaltitle' : 'booktitle';
        tagSeq = tagSeq.filter(tag => tag != second);
        let dateIndex = tagSeq.indexOf(first) + 1;
        tagSeq.splice(dateIndex, 0, second);
    }
    if (tagSeq.includes('booktitle') && tagSeq.includes('publisher')) {
        tagSeq = tagSeq.filter(tag => tag != 'publisher');
        let dateIndex = tagSeq.indexOf('booktitle') + 1;
        tagSeq.splice(dateIndex, 0, 'publisher');
    }

    // actually do it 
    let numFieldsAdded = 0;
    let dateFields = []; // this hackery relies on the ordering of (date, month, year) enforced above
    for (let field of tagSeq) {
        let fieldClass = 'table-row-field-' + field;
        let shouldComma = tagSeq.length != numFieldsAdded + 1;
        if (field in modified.entryTags && field in orig.entryTags) {
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                let addedText = indent + field + ' = {' + modEntry + '}';
                addedText += shouldComma ? ',' : '';
                tableElem.appendChild(rowWithText(addedText));
            } else {
                let modAdded = indent + field + ' = {' + modEntry + '}';
                modAdded += shouldComma ? ',' : '';
                let origAdded = indent + field + ' = {' + origEntry + '}';
                origAdded += shouldComma ? ',' : '';
                let entryElems = doDiffLine(origAdded, modAdded, [fieldClass, modifiedClass]);
                entryElems.forEach(function(entry) {
                    addStrikeEvents(entry, entryElems);
                    tableElem.appendChild(entry);
                });
            }
        } else if (field in modified.entryTags) {
            let addedText = indent + field + ' = {' + modified.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            let addedElem = rowWithText(addedText, [diffClasses['added']['bg'], fieldClass, modifiedClass]);
            addStrikeEvents(addedElem, [addedElem]);
            if (shouldDate && (field == 'month' || field == 'year')) {
                dateFields.push(addedElem);
                if (field == shouldDate) {
                    dateFields.forEach((df) => {
                        addStrikeEvents(df, dateFields);
                        tableElem.appendChild(df);
                    })
                }
            } else {
                tableElem.appendChild(addedElem);
            }
        } else {
            let removedText = indent + field + ' = {' + orig.entryTags[field] + '}';
            removedText += shouldComma ? ',' : '';
            let removedElem = rowWithText(removedText, [diffClasses['removed']['bg'], fieldClass, modifiedClass]);
            addStrikeEvents(removedElem, [removedElem]);
            if (shouldDate && field == 'date') {
                dateFields.push(removedElem);
            } else {
                tableElem.appendChild(removedElem);
            }
        }
        numFieldsAdded += 1;
    }
    tableElem.appendChild(rowWithText('}'));
    return parentElem;
}


// ########################################## 
// # Helper functions for random text 
// ########################################## 

function clearfix() {
    let c = document.createElement('div');
    c.classList.add('clearfix');
    return c;
}

function changeIofN(i, n) {
    let s = document.createElement('p');
    s.classList.add('change-i-of-n');
    s.innerText = 'Change ' + i + '/' + n;
    return s;
}

function acceptChangeRadio(relatedTable) {
    let parentE = document.createElement('div');
    parentE.classList.add('accept-change-radio');
    parentE.innerHTML = `<div class="btn-group btn-group-toggle" data-toggle="buttons">
  <label class="btn btn-outline-success btn-sm active">
    <input type="radio" name="options" id="option1" checked> Accept
  </label>
  <label class="btn btn-outline-danger btn-sm">
    <input type="radio" name="options" id="option2"> Reject 
  </label>
</div>`
    parentE.querySelector('.btn-outline-success').onclick = () => unhideTable(relatedTable);
    parentE.querySelector('.btn-outline-danger').onclick = () => hideTable(relatedTable);
    return parentE;
}

// ########################################## 
// # Helper functions for rendering diffs 
// ########################################## 

function allTablesHidden() {
    return $('table.hidden-table').length == $('table.result').length;
}

function allVisFieldsHidden() {
    return $('table.result:not(.hidden-table) tr.table-row-modified').length == $('table.result:not(.hidden-table) tr.table-row-modified.field-disabled').length;
}

function allVisFieldsHiddenForTable(table) {
    return $(table).children('tr.table-row-modified').length == $(table).children('tr.table-row-modified.field-disabled').length;
}

function hideTable(table) {
    table.classList.add('hidden-table');
    if (allTablesHidden()) {
        $('button.download-button').prop('disabled', true);
    } else if (allVisFieldsHidden()) {
        $('button.download-button').prop('disabled', true);
    }
}

function unhideTable(table) {
    table.classList.remove('hidden-table');
    if (!allVisFieldsHidden()) {
        $('button.download-button').prop('disabled', false);
    }
}

function diffedSpan(pre, changed, post, highlight_clazz, whole_clazz) {
    let parentSpan = document.createElement('span');
    parentSpan.appendChild(spanWithText(pre));
    parentSpan.appendChild(spanWithText(changed, highlight_clazz));
    parentSpan.appendChild(spanWithText(post));
    parentSpan.classList.add(whole_clazz);
    return parentSpan;
}

function spanWithText(text, clazz) {
    let s = document.createElement('span');
    s.textContent = text;
    if (!!clazz) {
        s.classList.add(clazz);
    }
    return s;
}

function rowWithText(text, clazz) {
    return rowWithElem(spanWithText(text), clazz);
}

function rowWithElem(elem, clazz) {
    let r = document.createElement('tr');
    let d = document.createElement('td');
    r.appendChild(d);
    d.appendChild(elem);
    if (!!clazz) {
        if (typeof(clazz) == 'string') {
            r.classList.add(clazz);
        } else {
            clazz.forEach(c => r.classList.add(c));
        }
    }
    return r;
}

function makeDiffLineElem(diff, prop, clazz) {
    let origE = document.createElement('span');
    diff.forEach((part) => {
        if (!part.added && !part.removed) {
            origE.appendChild(spanWithText(part.value));
        } else if (part[prop]) {
            origE.appendChild(spanWithText(part.value, diffClasses[prop]['text']));
        }
    });
    let row = rowWithElem(origE, diffClasses[prop]['bg']);
    if (typeof(clazz) == 'string') {
        row.classList.add(clazz);
    } else {
        clazz.forEach(c => row.classList.add(c));
    }
    return row;
}

function doDiffLine(origLine, modLine, clazz) {
    let diff = Diff.diffWords(origLine, modLine);
    let elems = [];
    elems.push(makeDiffLineElem(diff, 'removed', clazz));
    elems.push(makeDiffLineElem(diff, 'added', clazz));
    return elems;
}

