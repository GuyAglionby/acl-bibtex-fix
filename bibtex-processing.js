// https://github.com/zotero/translators/blob/7b0fe8cf1229ca7fbcce862d714204d7b4a4d25f/BibTeX.js#L505-L558
function splitUnprotected(str, delim) {
    delim.lastIndex = 0; // In case we're reusing a regexp
    var nextPossibleSplit = delim.exec(str);
    if (!nextPossibleSplit) return [str];

    var parts = [], open = 0, nextPartStart = 0;
    for (var i=0; i<str.length; i++) {
        if (i>nextPossibleSplit.index) {
            // Must have been inside braces
            nextPossibleSplit = delim.exec(str);
            if (!nextPossibleSplit) {
                parts.push(str.substr(nextPartStart));
                return parts;
            }
        }

        if (str[i] == '\\') {
            // Skip next character
            i++;
            continue;
        }

        if (str[i] == '{') {
            open++;
            continue;
        }

        if (str[i] == '}') {
            open--;
            if (open < 0) open = 0; // Shouldn't happen, but...
            continue;
        }

        if (open) continue;

        if (i == nextPossibleSplit.index) {
            parts.push(str.substring(nextPartStart, i));
            i += nextPossibleSplit[0].length - 1; // We can jump past the split delim
            nextPartStart = i + 1;
            nextPossibleSplit = delim.exec(str);
            if (!nextPossibleSplit) {
                parts.push(str.substr(nextPartStart));
                return parts;
            }
        }
    }

    // I don't think we should ever get here*, but just to be safe
    // *we should always be returning from the for loop
    var last = str.substr(nextPartStart).trim();
    if (last) parts.push(last);

    return parts;
}

// https://github.com/zotero/translators/blob/7b0fe8cf1229ca7fbcce862d714204d7b4a4d25f/BibTeX.js#L339-L367
function splitAuthorField(rawValue) {
    // parse authors/editors/translators
    var names = splitUnprotected(rawValue.trim(), /\s+and\s+/gi);
    for (var i in names) {
        var name = names[i];
        // skip empty names
        if (!name) continue;

        // Names in BibTeX can have three commas
        var pieces = splitUnprotected(name, /\s*,\s*/g);
        var creator = {};
        if (pieces.length > 1) {
            creator.firstName = pieces.pop();
            creator.lastName = unescapeBibTeX(pieces.shift());
            if (pieces.length) {
                // If anything is left, it should only be the 'Jr' part
                creator.firstName += ', ' + pieces.join(', ');
            }
            creator.firstName = unescapeBibTeX(creator.firstName);
            creator.creatorType = field;
        } else if (splitUnprotected(name, / +/g).length > 1){
            creator = cleanAuthor(unescapeBibTeX(name), field, false);
        } else {
            creator = {
                lastName: unescapeBibTeX(name),
                creatorType: field,
                fieldMode: 1
            };
        }
        item.creators.push(creator);
    }
}

// https://github.com/zotero/translators/blob/7b0fe8cf1229ca7fbcce862d714204d7b4a4d25f/BibTeX.js#L653-L705
function unescapeBibTeX(value) {
    if (value.length < 2) return value;

    // replace accented characters (yucky slow)
    value = value.replace(/{?(\\[`"'^~=]){?\\?([A-Za-z])}/g, "{$1$2}");
    // normalize some special characters, e.g. caron \v{c} -> {\v c}
    value = value.replace(/(\\[a-z]){(\\?[A-Za-z])}/g, "{$1 $2}");
    //convert tex markup into permitted HTML
    value = mapTeXmarkup(value);
    for (var mapped in reversemappingTable) { // really really slow!
        var unicode = reversemappingTable[mapped];
        while (value.includes(mapped)) {
            value = value.replace(mapped, unicode);
        }
        mapped = mapped.replace(/[{}]/g, "");
        while (value.includes(mapped)) {
            value = value.replace(mapped, unicode);
        }
    }

    // kill braces
    value = value.replace(/([^\\])[{}]+/g, "$1");
    if (value[0] == "{") {
        value = value.substr(1);
    }

    // chop off backslashes
    value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
    value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
    if (value[0] == "\\" && "#$%&~_^\\{}".includes(value[1])) {
        value = value.substr(1);
    }
    if (value[value.length-1] == "\\" && "#$%&~_^\\{}".includes(value[value.length-2])) {
        value = value.substr(0, value.length-1);
    }
    value = value.replace(/\\\\/g, "\\");
    value = value.replace(/\s+/g, " ");

    return value;
}

// https://github.com/zotero/zotero/blob/a8c682bf4beb003d6210f413fa5ba86ad621b8c4/chrome/content/zotero/xpcom/utilities.js#L82-L146
function cleanAuthor(author, type, useComma) {
    var allCaps = 'A-Z' +
        '\u0400-\u042f';		//cyrilic

    var allCapsRe = new RegExp('^[' + allCaps + ']+$');
    var initialRe = new RegExp('^-?[' + allCaps + ']$');

    author = author.replace(/^[\s\u00A0\.\,\/\[\]\:]+/, '')
        .replace(/[\s\u00A0\.\,\/\[\]\:]+$/, '')
        .replace(/[\s\u00A0]+/, ' ');

    if(useComma) {
        // Add spaces between periods
        author = author.replace(/\.([^ ])/, ". $1");

        var splitNames = author.split(/, ?/);
        if(splitNames.length > 1) {
            var lastName = splitNames[0];
            var firstName = splitNames[1];
        } else {
            var lastName = author;
        }
    } else {
        // Don't parse "Firstname Lastname [Country]" as "[Country], Firstname Lastname"
        var spaceIndex = author.length;
        do {
            spaceIndex = author.lastIndexOf(" ", spaceIndex-1);
            var lastName = author.substring(spaceIndex + 1);
            var firstName = author.substring(0, spaceIndex);
        } while (!XRegExp('\\pL').test(lastName[0]) && spaceIndex > 0)
    }

    if(firstName && allCapsRe.test(firstName) &&
        firstName.length < 4 &&
        (firstName.length == 1 || lastName.toUpperCase() != lastName)) {
        // first name is probably initials
        var newFirstName = "";
        for(var i=0; i<firstName.length; i++) {
            newFirstName += " "+firstName[i]+".";
        }
        firstName = newFirstName.substr(1);
    }

    //add periods after all the initials
    if(firstName) {
        var names = firstName.replace(/^[\s\.]+/,'')
            .replace(/[\s\,]+$/,'')
        //remove spaces surronding any dashes
            .replace(/\s*([\u002D\u00AD\u2010-\u2015\u2212\u2E3A\u2E3B])\s*/,'-')
            .split(/(?:[\s\.]+|(?=-))/);
        var newFirstName = '';
        for(var i=0, n=names.length; i<n; i++) {
            newFirstName += names[i];
            if(initialRe.test(names[i])) newFirstName += '.';
            newFirstName += ' ';
        }
        firstName = newFirstName.replace(/ -/g,'-').trim();
    }

    return {firstName:firstName, lastName:lastName, creatorType:type};
}
