// Hello, welcome to the jungle
var convertButton;
var downloadButton;
var resultsArea;

var bibtexFilename;
var bibtexContent;
var bibtexParsed;
var translatedEntries;

var reverseMapping;
var anthology;

window.onload = function() {
    // inputElement = document.getElementById('bibtex-upload');
    convertButton = document.getElementById('do-conversion-button');
    downloadButton = document.getElementById('download-button');
    resultsArea = document.getElementById('results-area');
    let noJsElem = document.getElementById('no-js');
    noJsElem.parentNode.removeChild(noJsElem);
    convertButton.disabled = true;
    downloadButton.disabled = true;
    getReverseMapping(); // technically a race here, but shouldn't be an issue
    loadAnthology();
}

const simplifyRegex = /[A-Za-z0-9]+/g;
const removeChars = ['\\', '{', '}', '$'];
const diacriticRegex = /[\u0300-\u036f]/g;

// Github colours
const diffClasses = {
    'removed': {
        'bg': 'removedLine',
        'text': 'removedText'
    },
    'added': {
        'bg': 'addedLine',
        'text': 'addedText'
    }
};

name_types = ['first', 'middle', 'last', 'prelast', 'lineage']

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
    let bibtexString = toBibtex(translatedEntries, false);
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(bibtexString));
    let downloadFilename = bibtexFilename.substring(0, bibtexFilename.length - '.bib'.length); 
    downloadFilename += '-acl-fixed.bib'
    element.setAttribute('download', downloadFilename);
    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

// ########################################## 
// # Bibtex matching and conversion 
// ########################################## 

function simplifyTitle(title) {
    for (let toRemove of removeChars) {
        title = title.replaceAll(toRemove, '');
    }
    title = title.toLowerCase();
    Object.keys(reverseMapping).forEach(function(source) {
        title = title.replace(source, reverseMapping[source])
    });
    title = title.normalize("NFD").replace(diacriticRegex, "");
    return [...title.matchAll(simplifyRegex)].join(' ')
}

function convert() {
    downloadButton.disabled = true;
    translatedEntries = bibtexParsed.map(entry => {
        let strippedTitle = simplifyTitle(entry['entryTags']['title']);
        if (strippedTitle in anthology) {
            let newEntry = JSON.parse(JSON.stringify(entry));
            let anthEntry = anthology[strippedTitle];
            // Changing from a journal to conference
            if (newEntry.entryType == 'article' && anthEntry.bibType == 'inproceedings') {
                delete newEntry.entryTags.eprint;
                delete newEntry.entryTags.eprinttype;
                delete newEntry.entryTags.journaltitle;
            }
            newEntry.entryType = anthEntry.bibType
            newEntry.entryTags.title = anthEntry.title
            newEntry.entryTags.doi = anthEntry.doi
            newEntry.entryTags.pages = anthEntry.pages
            newEntry.entryTags.publisher = anthEntry.publisher
            if (anthEntry.bibType == 'inproceedings') {
                newEntry.entryTags.booktitle = anthEntry.booktitle
            }
            if ("url" in anthEntry) {
                newEntry.entryTags.url = anthEntry.url;
            } else{
                delete newEntry.entryTags.url;
            }
            delete newEntry.entryTags.urldate;
            if ("month" in anthEntry) {
                delete newEntry.entryTags.date;
                newEntry.entryTags.month = anthEntry.month
                newEntry.entryTags.year = anthEntry.year;
            } else if ("date" in anthEntry) {
                newEntry.entryTags.date = anthEntry.date
            } else{
                console.warn("No date info available for title :" + strippedTitle);
            }
            resultsArea.appendChild(toDiffedBibtex(entry, newEntry));
            return newEntry;
        } else {
            return entry;
        }
    });
    downloadButton.disabled = false;
}

// ########################################## 
// # Render diffs 
// ########################################## 

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified) {
    let parentElem = document.createElement('table')
    parentElem.className += 'result'
    const entrysep = ',';
    const indent = '        ';

    if (modified.entryType == orig.entryType) {
        parentElem.appendChild(rowWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origLine = "@" + orig.entryType + "{" + modified.citationKey + entrysep;
        let modLine = "@" + modified.entryType + "{" + modified.citationKey + entrysep;
        doDiffLine(origLine, modLine, parentElem);
    }

    if (modified.entry) {
        parentElem.appendChild(rowWithText(modified.entry));
    }

    let modIdx = 0;
    let origIdx = 0;
    // Order that we should have the fields in when rendering the bibtex
    let tagSeq = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    // This is really just for aesthetics
    if (tagSeq.includes('date') && tagSeq.includes('month') && tagSeq.includes('year')) {
        tagSeq = tagSeq.filter(tag => tag != 'year' && tag != 'month');
        let dateIndex = tagSeq.indexOf('date') + 1;
        tagSeq.splice(dateIndex, 0, 'year')
        tagSeq.splice(dateIndex, 0, 'month')
    }
    if (tagSeq.includes('booktitle') && tagSeq.includes('journaltitle')) {
        let first = tagSeq.indexOf('booktitle') < tagSeq.indexOf('journaltitle') ? 'booktitle' : 'journaltitle';
        let second = first == 'booktitle' ? 'journaltitle' : 'booktitle';
        tagSeq = tagSeq.filter(tag => tag != second);
        let dateIndex = tagSeq.indexOf(first) + 1;
        tagSeq.splice(dateIndex, 0, second)
    }
    let numFieldsAdded = 0;
    for (let field of tagSeq) {
        let shouldComma = tagSeq.length != numFieldsAdded + 1;
        if (field in modified.entryTags && field in orig.entryTags) {
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                let addedText = indent + field + ' = {' + modEntry + '}';
                addedText += shouldComma ? ',' : '';
                parentElem.appendChild(rowWithText(addedText))
            } else {
                let modAdded = indent + field + ' = {' + modEntry;
                modAdded += shouldComma ? ',' : '';
                let origAdded = indent + field + ' = {' + origEntry;
                origAdded += shouldComma ? ',' : '';
                doDiffLine(origAdded, modAdded, parentElem);
            }
        } else if (field in modified.entryTags){ 
            let addedText = indent + field + ' = {' + modified.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            parentElem.appendChild(rowWithText(addedText, diffClasses['added']['bg']));
        } else {
            let addedText = indent + field + ' = {' + orig.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            parentElem.appendChild(rowWithText(addedText, diffClasses['removed']['bg']));
        }
        numFieldsAdded += 1;
    }
    parentElem.appendChild(rowWithText('}'))
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
    for ( var i in json) {
        out += "@" + json[i].entryType;
        out += '{';
        if (json[i].citationKey)
            out += json[i].citationKey + entrysep;
        if (json[i].entry)
            out += json[i].entry ;
        if (json[i].entryTags) {
            var tags = indent;
            for (var jdx in json[i].entryTags) {
                if (tags.trim().length != 0)
                    tags += entrysep + indent;
                tags += jdx + (compact ? '={' : ' = {') + 
                        json[i].entryTags[jdx] + '}';
            }
            out += tags;
        }
        out += compact ? '}\n' : '\n}\n\n';
    }
    return out;

};

// ########################################## 
// # Helper functions for rendering diffs 
// ########################################## 

function diffedSpan(pre, changed, post, highlight_clazz, whole_clazz) {
    let parentSpan = document.createElement('span');
    parentSpan.appendChild(spanWithText(pre))
    parentSpan.appendChild(spanWithText(changed, highlight_clazz))
    parentSpan.appendChild(spanWithText(post))
    parentSpan.className += whole_clazz;
    return parentSpan;
}

function spanWithText(text, clazz) {
    let s = document.createElement('span')
    s.textContent = text;
    if (!!clazz) {
        s.className += clazz;
    }
    return s;
}

function rowWithText(text, clazz) {
    return rowWithElem(spanWithText(text), clazz);
}

function rowWithElem(elem, clazz) {
    let r = document.createElement('tr')
    let d = document.createElement('td')
    r.appendChild(d)
    d.appendChild(elem)
    if (!!clazz) {
        r.className += clazz;
    }
    return r;
}

function makeDiffLineElem(diff, prop) {
    let origE = document.createElement('span');
    diff.forEach((part) => {
        if (!part.added && !part.removed) {
            origE.appendChild(spanWithText(part.value));
        } else if (part[prop]) {
            origE.appendChild(spanWithText(part.value, diffClasses[prop]['text']));
        }
    });
    return rowWithElem(origE, diffClasses[prop]['bg']);
}

function doDiffLine(origLine, modLine, parentElem) {
    let diff = Diff.diffWords(origLine, modLine);
    parentElem.appendChild(makeDiffLineElem(diff, 'removed')) 
    parentElem.appendChild(makeDiffLineElem(diff, 'added'))
}

// ########################################## 
// # Loading stuff from server
// ########################################## 

function loadJsonGz(file, callback) {
    fetch(file)
        .then(response => response.arrayBuffer())
        .then(response => pako.inflate(response))
        .then(response => new TextDecoder("ascii").decode(response))
        .then(response => JSON.parse(response))
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

