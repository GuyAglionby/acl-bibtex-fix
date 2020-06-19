// Hello, welcome to the jungle
var convertButton;
var resultsArea;

var bibtexContent;
var bibtexParsed;

var reverseMapping;
var anthology;

window.onload = function() {
    // inputElement = document.getElementById('bibtex-upload');
    convertButton = document.getElementById('do-conversion-button');
    resultsArea = document.getElementById('results-area');
    let noJsElem = document.getElementById('no-js');
    noJsElem.parentNode.removeChild(noJsElem);
    convertButton.disabled = true;
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

name_types = ['first', 'middle', 'last', 'prelast', 'lineage']

function inputElementOnChange(elem) { 
    // https://stackoverflow.com/questions/16215771/how-open-select-file-dialog-via-js/16215950
    convertButton.disabled = true;
    let file = elem.files[0];
    let reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = readerEvent => {
        bibtexContent = readerEvent.target.result;
        bibtexParsed = bibtexParse.toJSON(bibtexContent);
        convertButton.disabled = false;
    }
}

function convert() {
    let changedKeys = [];
    let changedEntries = bibtexParsed.map(entry => {
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
                console.warn("No date info available for title :"+strippedTitle);
            }
//            console.log(bibtexParse.toBibtex([newEntry], false))
            //return {'key': newEntry.citationKey, 'new': bibtexParse.toBibtex([newEntry])};
            changedKeys.push(newEntry.citationKey);
            let thisDiffElement = toDiffedBibtex(entry, newEntry)
            resultsArea.appendChild(thisDiffElement);
//            return (entry, newEntry);
        }
    }).filter(entry => !!entry);
//    console.log(bibtexParse.toBibtex(changedEntries, false));
//    console.log('\n\n\n\n')
//    console.log(bibtexContent);
}

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

function br() {
    let b = document.createElement('br')
    b.className += "code-br";
    return b
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
    origE.className += diffClasses[prop]['bg'];
    return origE
}

function doDiffLine(origLine, modLine, parentElem) {
    let diff = Diff.diffWords(origLine, modLine);
    parentElem.appendChild(makeDiffLineElem(diff, 'removed')) 
    parentElem.appendChild(br());
    parentElem.appendChild(makeDiffLineElem(diff, 'added'))
    parentElem.appendChild(br());
}

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified) {
    let parentElem = document.createElement('div')
    parentElem.className += 'result'
    var diff = Diff.diffJson(orig, modified)
    const entrysep = ',';
    const entrysepL = ',\n';
    const indent = '        ';

    if (modified.entryType == orig.entryType) {
        parentElem.appendChild(spanWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origLine = "@" + orig.entryType + "{" + modified.citationKey + entrysep;
        let modLine = "@" + modified.entryType + "{" + modified.citationKey + entrysep;
        doDiffLine(origLine, modLine, parentElem);
    }

    if (modified.entry) {
        parentElem.appendChild(spanWithText(modified.entry));
        parentElem.appendChild(br());
    }

    let modIdx = 0;
    let origIdx = 0;
    let tagSeq = Diff.diffArrays(Object.keys(modified.entryTags), Object.keys(orig.entryTags)).map(x=>x.value).reduce((a, v) => a.concat(v), []);
    var tags = indent;
    let numFieldsAdded = 0;
    for (let field of tagSeq) {
        let shouldComma = tagSeq.length != numFieldsAdded + 1;
        tags += field + ' = {' + modified.entryTags[field] + '}';
        if (field in modified.entryTags && field in orig.entryTags) {
            let modEntry = modified.entryTags[field];
            let origEntry = orig.entryTags[field];
            if (modEntry == origEntry) {
                let addedText = indent + field + ' = {' + modEntry + '}';
                addedText += shouldComma ? ',' : '';
                parentElem.appendChild(spanWithText(addedText))
                parentElem.appendChild(br());
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
            parentElem.appendChild(spanWithText(addedText, diffClasses['added']['bg']));
            parentElem.appendChild(br());
        } else {
            let addedText = indent + field + ' = {' + orig.entryTags[field] + '}';
            addedText += shouldComma ? ',' : '';
            parentElem.appendChild(spanWithText(addedText, diffClasses['removed']['bg']));
            parentElem.appendChild(br());
        }
        numFieldsAdded += 1;
    }
    parentElem.appendChild(spanWithText('}'))
    return parentElem;
};
function generateBibtexFromConversions(changedEntries) {
    
}

function loadJsonGz(file, callback) {
    fetch(file)
        .then(response => response.arrayBuffer())
        .then(response => pako.inflate(response))
        .then(response => new TextDecoder("ascii").decode(response))
        .then(response => JSON.parse(response))
        .then(callback);
}

function getReverseMapping() {
  /*  fetch('./reverseMappingTable.json.gz')
        .then(response => response.arrayBuffer())
        .then(response => pako.inflate(response))
        .then(response => new TextDecoder("ascii").decode(response))
        .then(response => saveReverseMapping(response));*/
    loadJsonGz('./reverseMappingTable.json.gz', saveReverseMapping);
}

function saveReverseMapping(mapping) {
    reverseMapping = mapping;
}

function loadAnthology() {
    loadJsonGz('./anthology_data.json.gz', saveAnthology);
    /*fetch('./anthology_data.json.gz')
        .then(response => response.arrayBuffer())
        .then(response => pako.inflate(response))
        .then(response => new TextDecoder("ascii").decode(response))
        .then(saveAnthology);*/
}

function saveAnthology(anth) {
    anthology = anth;
}

