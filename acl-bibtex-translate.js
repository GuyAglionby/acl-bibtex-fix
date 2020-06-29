// Hello, welcome to the jungle
var convertButton;
var resultsArea;

var bibtexFilename;
var bibtexContent;
var bibtexParsed;
var bibtexKeyToIdx;
var translatedEntries;

var reverseMapping;
var anthology;


window.onload = function() {
    // https://www.w3schools.com/bootstrap4/bootstrap_forms_custom.asp
    $(".custom-file-input").on("change", function() {
      var fileName = $(this).val().split("\\").pop();
      $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
    });
    let noJsElem = document.getElementById('no-js');
    noJsElem.parentNode.removeChild(noJsElem);
    inputElement = document.getElementById('bibtex-upload');
    convertButton = document.getElementById('do-conversion-button');
    resultsArea = document.getElementById('results-area');

    getReverseMapping(); // technically a race here, but shouldn't be an issue
    loadAnthology();
}

const simplifyRegex = /[A-Za-z0-9]+/g;
const removeChars = ['\\', '{', '}', '$'];
const diacriticRegex = /[\u0300-\u036f]/g;

// Github colours
const diffClasses = {
    'removed': {
        'bg': 'removed-line',
        'text': 'removed-text'
    },
    'added': {
        'bg': 'added-line',
        'text': 'added-text'
    }
};

name_types = ['first', 'middle', 'last', 'prelast', 'lineage'];

// date formats
const dateFormats = [
    "YYYY-MM-DD",
    "MM-YYYY",
    "MMM-YYYY",
    "MMMM-YYYY",
    "YYYY-MM",
    "YYYY-MMM",
    "YYYY-MMMM",
];

const monthFormats = [
    "MM",
    "MMM",
    "MMMM",
];

function inputElementOnChange(elem) { 
    // https://stackoverflow.com/questions/16215771/how-open-select-file-dialog-via-js/16215950
    convertButton.disabled = true;
    let file = elem.files[0];
    bibtexFilename = file.name;
    let reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
        bibtexContent = readerEvent.target.result;
        bibtexParsed = bibtexParse.toJSON(bibtexContent);
        convertButton.disabled = false;
    }
}

function download() {
    let removedTables = $("table.hidden-table");
    let translWithRemoval = JSON.parse(JSON.stringify(translatedEntries));
    $('table.hidden-table').each(function(i) {
        this.classList.forEach((clazz) => { 
            if (clazz.startsWith('table-id-')) {
                let citationKey = clazz.substring('table-id-'.length, clazz.length);
                let idx = bibtexKeyToIdx[citationKey];
                translWithRemoval[idx] = bibtexParsed[idx];
            }
        });
    });

    let bibtexString = toBibtex(translWithRemoval, false);
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(bibtexString));
    let downloadFilename = bibtexFilename.substring(0, bibtexFilename.length - '.bib'.length);
    downloadFilename += '-acl-fixed.bib';
    element.setAttribute('download', downloadFilename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function downloadSample() {
    loadGz('./example.bib.gz', useSample);
}

function useSample(bibText) {
    console.log(bibText);
    bibtexParsed = bibtexParse.toJSON(bibText);
    bibtexFilename = 'example.bib';
    convertButton.disabled = false;
    convert();
}

// ########################################## 
// # Bibtex matching and conversion 
// ########################################## 

function matchDate(dateString, formats) {
    let existingDate;
    for (let dateFormat of formats) {
        existingDate = moment(dateString, dateFormat);
        if (existingDate.isValid()) {
            break;
        }
    }
    return existingDate;
}


function simplifyTitle(title) {
    for (let toRemove of removeChars) {
        title = title.replaceAll(toRemove, '');
    }
    title = title.toLowerCase();
    Object.keys(reverseMapping).forEach(function(source) {
        title = title.replace(source, reverseMapping[source]);
    });
    title = title.normalize("NFD").replace(diacriticRegex, "");
    return [...title.matchAll(simplifyRegex)].join(' ');
}

function convert() {
    resultsArea.innerHTML = '';
    $(".download-button").css({'display': 'none'});
    resultsArea.appendChild(document.createElement('hr'));
    resultsArea.appendChild(spanWithText('Loaded ' + bibtexParsed.length + ' BibTeX entries'));
    let numChanges = 0;
    let idx = 0;
    bibtexKeyToIdx = {};
    translatedEntries = bibtexParsed.map(entry => {
        let strippedTitle = simplifyTitle(entry['entryTags']['title']);
        idx += 1;
        if (strippedTitle in anthology) {
            let newEntry = JSON.parse(JSON.stringify(entry));
            let anthEntry = anthology[strippedTitle];
            // Changing from a journal to conference
            if (newEntry.entryType == 'article' && anthEntry.bibType == 'inproceedings') {
                delete newEntry.entryTags.eprint;
                delete newEntry.entryTags.eprinttype;
                delete newEntry.entryTags.journaltitle;
                delete newEntry.entryTags.journal;
            }
            if (anthEntry.bibType == 'article') {
                if ('journaltitle' in newEntry.entryTags) {
                    newEntry.entryTags.journaltitle = anthEntry.journal;
                    delete newEntry.entryTags.journal;
                } else {
                    newEntry.entryTags.journal = anthEntry.journal;
                    delete newEntry.entryTags.journaltitle;
                }
            }
            newEntry.entryType = anthEntry.bibType;
            newEntry.entryTags.title = anthEntry.title;
            newEntry.entryTags.pages = anthEntry.pages;
            if (anthEntry.bibType == 'inproceedings') {
                newEntry.entryTags.booktitle = anthEntry.booktitle;
            }
            for (let possTag of ["doi", "pages", "publisher"]) {
                if (possTag in anthEntry) {
                    newEntry.entryTags[possTag] = anthEntry[possTag];
                }
            }
            if ("url" in anthEntry) {
                newEntry.entryTags.url = anthEntry.url;
            } else {
                if ('arxiv' in newEntry.entryTags.url.toLowerCase()) {
                    delete newEntry.entryTags.url;
                }
            }
            if ("month" in anthEntry) {
                if ("date" in newEntry.entryTags) {
                    let existingDate = matchDate(newEntry.entryTags.date, dateFormats);
                    let anthMonth = matchDate(anthEntry.month, monthFormats);
                    if (existingDate.isValid() && anthMonth.isValid()) {
                        // Only change existing dates if they're wrong (don't change format just for the sake of it)
                        if (existingDate.year() != anthEntry.year || existingDate.month()  != anthMonth.month()) {
                            delete newEntry.entryTags.date;
                            newEntry.entryTags.month = anthEntry.month;
                            newEntry.entryTags.year = anthEntry.year;
                        }
                    } else {
                        delete newEntry.entryTags.date;
                        newEntry.entryTags.month = anthEntry.month;
                        newEntry.entryTags.year = anthEntry.year;
                    }
                } else {
                    newEntry.entryTags.month = anthEntry.month;
                    newEntry.entryTags.year = anthEntry.year;
                }
            } else if ("date" in anthEntry) {
                newEntry.entryTags.date = anthEntry.date;
            } else{
                console.warn("No date info available for title :" + strippedTitle);
            }
            if (!_.isEqual(entry, newEntry)) {
                numChanges += 1;
                bibtexKeyToIdx[newEntry.citationKey] = idx - 1;
            }
            return newEntry;
        } else {
            return entry;
        }
    });

    let ithChange = 1;
    for (let i = 0; i < translatedEntries.length; i++) {
        if (!_.isEqual(bibtexParsed[i], translatedEntries[i])) {
            let changeNumDiv = changeIofN(ithChange, numChanges);
            ithChange += 1;
            resultsArea.append(changeNumDiv);
            resultsArea.appendChild(toDiffedBibtex(bibtexParsed[i], translatedEntries[i]));
        }
    }

    if (numChanges > 0) {
        $(".download-button").css({'display': ''});
    } else {
        let noResultsElem = document.createElement('p');
        noResultsElem.textContent('No changes found!');
        resultsArea.appendChild(noResultsElem);
    }
    resultsArea.appendChild(document.createElement('hr'));
}

// ########################################## 
// # Render diffs 
// ########################################## 

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified) {
    let parentElem = document.createElement('div');
    parentElem.classList.add('col-lg-10');
    parentElem.classList.add('offset-lg-1');
    let tableElem = document.createElement('table');
    tableElem.classList.add('result');
    tableElem.classList.add('table-id-' + modified.citationKey);

    parentElem.appendChild(acceptChangeRadio(tableElem));
    parentElem.appendChild(clearfix());
    parentElem.appendChild(tableElem);

    const entrysep = ',';
    const indent = '        ';

    if (modified.entryType == orig.entryType) {
        tableElem.appendChild(rowWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origLine = "@" + orig.entryType + "{" + modified.citationKey + entrysep;
        let modLine = "@" + modified.entryType + "{" + modified.citationKey + entrysep;
        doDiffLine(origLine, modLine, tableElem, 'table-row-bibtextype');
    }

    if (modified.entry) {
        tableElem.appendChild(rowWithText(modified.entry));
    }

    let modIdx = 0;
    let origIdx = 0;
    // Order that we should have the fields in when rendering the bibtex
    let tagSeq = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    // This is really just for aesthetics
    if (tagSeq.includes('date') && tagSeq.includes('month') && tagSeq.includes('year')) {
        tagSeq = tagSeq.filter(tag => tag != 'year' && tag != 'month');
        let dateIndex = tagSeq.indexOf('date') + 1;
        tagSeq.splice(dateIndex, 0, 'year');
        tagSeq.splice(dateIndex, 0, 'month');
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
    let numFieldsAdded = 0;
    for (let field of tagSeq) {
        let fieldClass = 'table-row-' + field;
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
                doDiffLine(origAdded, modAdded, tableElem, fieldClass);
            }
        } else if (field in modified.entryTags) {
            let addedText = indent + field + ' = {' + modified.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            tableElem.appendChild(rowWithText(addedText, [diffClasses['added']['bg'], fieldClass]));
        } else {
            let addedText = indent + field + ' = {' + orig.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            tableElem.appendChild(rowWithText(addedText, [diffClasses['removed']['bg'], fieldClass]));
        }
        numFieldsAdded += 1;
    }
    tableElem.appendChild(rowWithText('}'));
    return parentElem;
}

/*
 * Original by Nick Bailey (2017)
 * (cdn version isn't complete)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toBibtex(json, compact) {
    if (compact === undefined) compact = true;
    var out = '';

    var entrysep = ',';
    var indent = '';
    if (!compact) {
      entrysep = ',\n';
      indent = '    ';
    }
    for (var i in json) {
        out += "@" + json[i].entryType;
        out += '{';
        if (json[i].citationKey) {
            out += json[i].citationKey + entrysep;
        }
        if (json[i].entry) {
            out += json[i].entry;
        }
        if (json[i].entryTags) {
            var tags = indent;
            for (var jdx in json[i].entryTags) {
                if (tags.trim().length != 0) {
                    tags += entrysep + indent;
                }
                tags += jdx + (compact ? '={' : ' = {') + 
                        json[i].entryTags[jdx] + '}';
            }
            out += tags;
        }
        out += compact ? '}\n' : '\n}\n\n';
    }
    return out;
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

function hideTable(table) {
    table.classList.add('hidden-table');
}

function unhideTable(table) {
    table.classList.remove('hidden-table');
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
    row.classList.add(clazz);
    return row;
}

function doDiffLine(origLine, modLine, parentElem, clazz) {
    let diff = Diff.diffWords(origLine, modLine);
    parentElem.appendChild(makeDiffLineElem(diff, 'removed', clazz));
    parentElem.appendChild(makeDiffLineElem(diff, 'added', clazz));
}

// ########################################## 
// # Loading stuff from server
// ########################################## 

function loadJsonGz(file, callback) {
    loadGz(file, response => {
        callback(JSON.parse(response))
    });
}

function loadGz(file, callback) {
    fetch(file)
        .then(response => response.arrayBuffer())
        .then(response => pako.inflate(response))
        .then(response => new TextDecoder("ascii").decode(response))
        .then(callback);
}

function getReverseMapping() {
    loadJsonGz('./reverseMappingTable.json.gz', saveReverseMapping);
}

function saveReverseMapping(mapping) {
    reverseMapping = mapping;
}

function loadAnthology() {
    loadJsonGz('./anthology_data.json.gz', saveAnthology);
}

function saveAnthology(anth) {
    anthology = anth;
}

