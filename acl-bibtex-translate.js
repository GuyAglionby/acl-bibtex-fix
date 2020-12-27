// Hello, welcome to the jungle

var bibtexFilename;
var bibtexContent;
var bibtexParsed;
var bibtexKeyToIdx;
var translatedEntries;

var reverseMapping;
var anthology;


window.onload = function() {
    $(".custom-file-input").on("change", function() {
      var fileName = $(this).val().split("\\").pop();
      $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
    });
    $("#no-js").remove();
    loadJsonGz("./reverseMappingTable.json.gz", saveReverseMapping);
    loadJsonGz("./anthology_data.json.gz", saveAnthology);
}

// Github colours
const diffClasses = {
    "removed": {
        "bg": "removed-line",
        "text": "removed-text"
    },
    "added": {
        "bg": "added-line",
        "text": "added-text"
    }
};

function inputElementOnChange(elem) { 
    // https://stackoverflow.com/questions/16215771/how-open-select-file-dialog-via-js/16215950
    $("#do-conversion-button").prop("disabled", true);
    let file = elem.files[0];
    bibtexFilename = file.name;
    let reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = readerEvent => {
        bibtexContent = readerEvent.target.result;
        bibtexParsed = bibtexParse.toJSON(bibtexContent);
        $("#do-conversion-button").prop("disabled", false);
    }
}

function classKeyFromElem(elem, prefix) {
    for (let clazz of elem.classList) {
        if (clazz.startsWith(prefix)) {
            return clazz.substring(prefix.length, clazz.length);
        }
    }
}

function download() {
    let removedTables = $("table.hidden-table");
    let translWithRemoval = JSON.parse(JSON.stringify(translatedEntries));
    $("table.hidden-table").each(function(i) {
        let citationKey = classKeyFromElem(this, "table-id-");
        let idx = bibtexKeyToIdx[citationKey];
        translWithRemoval[idx] = bibtexParsed[idx];
    });
    $("tr.field-disabled").each(function(i) {
        let citationKey = classKeyFromElem(this.parentNode, "table-id-");
        let idx = bibtexKeyToIdx[citationKey];
        let field = classKeyFromElem(this, "table-row-field-");
        if (field == "bibtextype") {
            translWithRemoval[idx]["entryType"] = bibtexParsed[idx]["entryType"];
        } else {
            if (field in bibtexParsed[idx]["entryTags"]) {
                translWithRemoval[idx]["entryTags"][field] = bibtexParsed[idx]["entryTags"][field];
            } else {
                delete translWithRemoval[idx]["entryTags"][field];
            }
        }
    });

    let bibtexString = toBibtex(translWithRemoval, false);
    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(bibtexString));
    let downloadFilename = bibtexFilename.substring(0, bibtexFilename.length - ".bib".length);
    downloadFilename += "-acl-fixed.bib";
    element.setAttribute("download", downloadFilename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function downloadSample() {
    loadGz("./example.bib.gz", useSample);
}

function useSample(bibText) {
    bibtexParsed = bibtexParse.toJSON(bibText);
    bibtexFilename = "example.bib";
    $(".custom-file-label").html(bibtexFilename);
    $("#do-conversion-button").prop("disabled", false);
    convert();
}

/*
 * Original by Nick Bailey (2017)
 * (cdn version isn't complete)
 * https://github.com/ORCID/bibtexParseJs/blob/master/bibtexParse.js#L323-L354
 */
function toBibtex(json, compact) {
    if (compact === undefined) compact = true;
    var out = "";

    var entrysep = ",";
    var indent = "";
    if (!compact) {
      entrysep = ",\n";
      indent = "    ";
    }
    for (var i in json) {
        out += "@" + json[i].entryType;
        out += "{";
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
                tags += jdx + (compact ? "={" : " = {") + 
                        json[i].entryTags[jdx] + "}";
            }
            out += tags;
        }
        out += compact ? "}\n" : "\n}\n\n";
    }
    return out;
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

function saveReverseMapping(mapping) {
    reverseMapping = mapping;
    let matcher = /{\\([A-Za-z]) ([A-Za-z])}/;
    for (const [bib, unic] of Object.entries(reverseMapping)) {
        let match = bib.match(matcher);
        if (match) {
            let newBib = "{\\" + match[1] + "{" + match[2] + "}}";
            reverseMapping[newBib] = unic;
        }
    }
}

function saveAnthology(anth) {
    anthology = anth;
}

