const simplifyRegex = /[A-Za-z0-9]+/g;
const titleRemoveChars = ["\\", "{", "}", "$"];
const diacriticRegex = /[\u0300-\u036f]/g;

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

function simplifyTitle(title) {
    for (let toRemove of titleRemoveChars) {
        title = title.replaceAll(toRemove, "");
    }
    title = title.toLowerCase();
    Object.keys(reverseMapping).forEach(function(source) {
        title = title.replace(source, reverseMapping[source]);
    });
    title = title.normalize("NFD").replace(diacriticRegex, "");
    return [...title.matchAll(simplifyRegex)].join(" ");
}

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

function nameFromComponents(parts, components) {
    let compound = [];
    for (let p of components) {
        if (!!parts[p]) {
            compound.push(...parts[p]);
        }
    }
    return compound;
}

function nameFromParts(parts) {
    let authorLast = nameFromComponents(parts, ["prelast", "last", "lineage"]).join(" ")
    let authorFirst = nameFromComponents(parts, ["first", "middle"]).join(" ")
    return [authorLast, authorFirst].join(", ")
}

function resolveAccents(anthText, userText) {
    // This won't do exactly as intended if their text has 
    // a mix of bibtex-encoded and unicode-encoded chars
    for (const [bib, unicode] of Object.entries(reverseMapping)) {
        if (userText.includes(bib)) {
            anthText = anthText.replaceAll(unicode, bib);
        } else if (userText.includes(unicode)) {
            anthText = anthText.replaceAll(bib, unicode);
        }
    }
    return anthText;
}

function matchAnthEntry(title) {
    if (title in anthology) {
        return anthology[title];
    }
    return false;
}

function convert() {
    $("#results-area").empty();
    $(".download-button").css({"display": "none"});
    $("#results-area").append(spanWithText("Loaded " + bibtexParsed.length + " BibTeX entries", "loaded-entries-text"));
    $("#results-area").append($(document.createElement("hr")));
    let numChanges = 0;
    let idx = 0;
    bibtexKeyToIdx = {};
    translatedEntries = bibtexParsed.map(entry => {
        let strippedTitle = simplifyTitle(entry["entryTags"]["title"]);
        idx += 1;
        let anthEntry = matchAnthEntry(strippedTitle);
        if (anthEntry) {
            let newEntry = JSON.parse(JSON.stringify(entry));
            // Changing from a journal to conference
            if (newEntry.entryType == "article" && anthEntry.bibType == "inproceedings") {
                delete newEntry.entryTags.eprint;
                delete newEntry.entryTags.eprinttype;
                delete newEntry.entryTags.journaltitle;
                delete newEntry.entryTags.journal;
            }
            // Other way around (less likely to see this?)
            if (newEntry.entryType == "inproceedings" && anthEntry.bibType == "article") {
                delete newEntry.entryTags.booktitle;
            }
            if (anthEntry.bibType == "article") {
                if ("journaltitle" in newEntry.entryTags) {
                    newEntry.entryTags.journaltitle = anthEntry.journal;
                    delete newEntry.entryTags.journal;
                } else {
                    newEntry.entryTags.journal = anthEntry.journal;
                    delete newEntry.entryTags.journaltitle;
                }
            }
            newEntry.entryType = anthEntry.bibType;
            newEntry.entryTags.title = anthEntry.title;

            if (anthEntry.bibType == "inproceedings") {
                newEntry.entryTags.booktitle = anthEntry.booktitle;
            }
            for (let possTag of ["doi", "pages", "publisher", "pages"]) {
                if (possTag in anthEntry) {
                    newEntry.entryTags[possTag] = anthEntry[possTag];
                }
            }

            for (const contributorType of ["author", "editor"]) {
                if (contributorType in anthEntry.people) {
                    let contributors = anthEntry.people[contributorType].map(nameFromParts);
                    let contributorsJoined = contributors.join(" and ");
                    newEntry.entryTags[contributorType] = resolveAccents(contributorsJoined, newEntry.entryTags[contributorType]);
                } else {
                    delete newEntry.entryTags[contributorType];
                }
            }

            if ("url" in anthEntry) {
                newEntry.entryTags.url = anthEntry.url;
            } else {
                if ("arxiv" in newEntry.entryTags.url.toLowerCase()) {
                    delete newEntry.entryTags.url;
                }
            }

            if ("date" in newEntry.entryTags) {
                let existingDate = matchDate(newEntry.entryTags.date, dateFormats);
                let anthMonth = matchDate(anthEntry.month, monthFormats);
                if (existingDate.isValid()) {
                    if (anthMonth.isValid()) {
                        // Only change existing dates if they're wrong (don't change format just for the sake of it)
                        if (existingDate.year() != anthEntry.year || existingDate.month()  != anthMonth.month()) {
                            delete newEntry.entryTags.date;
                            newEntry.entryTags.month = anthEntry.month;
                            newEntry.entryTags.year = anthEntry.year;
                        }
                    } else {
                        newEntry.entryTags.date = anthEntry.year;
                        delete newEntry.entryTags.month;
                    }
                } else {
                    // If we can't match their date, throw it away
                    delete newEntry.entryTags.date;
                    if (anthEntry.month) {
                        newEntry.entryTags.month = anthEntry.month;
                    }
                    newEntry.entryTags.year = anthEntry.year;
                }
            } else {
                let existingMonth = matchDate(newEntry.entryTags.month, monthFormats);
                let anthMonth = matchDate(anthEntry.month, monthFormats);
                if (!anthMonth) {
                    delete newEntry.entryTags.month;
                } else if (existingMonth.month() != anthMonth.month()) {
                    newEntry.entryTags.month = anthEntry.month;
                }
                newEntry.entryTags.year = anthEntry.year;
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
            let parentElem = $(document.createElement("div"));
            parentElem.addClass("col-lg-10");
            parentElem.addClass("offset-lg-1");
            
            let changeNumDiv = changeIofN(ithChange, numChanges);
            parentElem.append(changeNumDiv);
            
            toDiffedBibtex(bibtexParsed[i], translatedEntries[i], parentElem);

            let hr = $(document.createElement("hr"));
            hr.addClass("result-divide");
            parentElem.append(hr);

            $("#results-area").append(parentElem);
            ithChange += 1;
        }
    }
    if (numChanges > 0) {
        $(".download-button").css({"display": ""});
        $("hr.result-divide").last().remove();
    } else {
        let noResultsElem = $(document.createElement("p"));
        noResultsElem.textContent = "No changes found!";
        noResultsElem.addClass("no-changes")
        $("#results-area").append(noResultsElem);
    }
    $("#results-area").append($(document.createElement("hr")));
}
