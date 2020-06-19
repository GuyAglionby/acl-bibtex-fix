import json
import tqdm
from pybtex.database.input import bibtex
import re
import gzip

simplify_re = re.compile(r'[A-Za-z0-9]+')
remove_chars = ['\\', '{', '}', '$']
name_types = ['first', 'middle', 'last', 'prelast', 'lineage']

def simplify_title(title):
    for remove in remove_chars:
        title = title.replace(remove, '')
    title = title.lower()
    return ' '.join(simplify_re.findall(title))


def main():
    bib_file = 'anthology.bib'
    parser = bibtex.Parser()
    print('Parsing bib file')
    bib_data = parser.parse_file(bib_file)

    resulting = {}
    for entry in tqdm.tqdm(bib_data.entries.values()):
        new_key = simplify_title(entry.fields['title'])
        entry.fields['bibType'] = entry.type
        entry.fields['people'] = {}

        for person_type, people in entry.persons.items():
            people_list = []
            for person in people:
                person_dict = {}
                for n in name_types:
                    if len(person.get_part(n)):
                        person_dict[n] = person.get_part(n)
                people_list.append(person_dict)
            entry.fields['people'][person_type] = people_list
        resulting[new_key] = dict(entry.fields)

    with gzip.open('anthology_data.json.gz', 'wb') as f:
        json_s = json.dumps(resulting)
        f.write(json_s.encode('utf-8'))


if __name__ == '__main__':
    main()
