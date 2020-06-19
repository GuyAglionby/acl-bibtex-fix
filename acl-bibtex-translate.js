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
const removedLineClass = 'removedLine'
const removedTextClass = 'removedText'
const addedLineClass = 'addedLine'
const addedTextClass = 'addedText'


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

/*
 * Modified from original by Nick Bailey (2017)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toDiffedBibtex(orig, modified) {
    let parentElem = document.createElement('div')
    var diff = Diff.diffJson(orig, modified)
   /* console.log('orig')
    console.log(orig)
    console.log('modified')
    console.log(modified)
    console.log('diff')
    console.log(diff)
    console.log('end diff')*/
    var out = ''; 
    const entrysep = ',';
    const entrysepL = ',\n';
    const indent = '    ';

    console.log(orig)
    if (modified.entryType == orig.entryType) {
        parentElem.appendChild(spanWithText("@" + modified.entryType + "{" + modified.citationKey + entrysep));
    } else {
        let origDiffLine = diffedSpan("@", orig.entryType, "{" + modified.citationKey + entrysep, removedTextClass, removedLineClass)
        let modifiedDiffLine = diffedSpan("@", modified.entryType, "{" + modified.citationKey + entrysep, addedTextClass, addedLineClass)
        console.log(origDiffLine);
        console.log(modifiedDiffLine);
        parentElem.appendChild(origDiffLine);
        parentElem.appendChild(br());
        parentElem.appendChild(modifiedDiffLine);
    }
    return parentElem
    /*out += '{';
    if (modified.citationKey)
        out += modified.citationKey + entrysep;

    if (modified.entry)
        out += modified.entry ;
    if (modified.entryTags) {
        var tags = indent;
        for (var jdx in modified.entryTags) {
            if (tags.trim().length != 0)
                tags += entrysep + indent;
            tags += jdx + ' = {' + 
                    modified.entryTags[jdx] + '}';
        }
        out += tags;
    }
    out += '\n}';
    return out;*/

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

