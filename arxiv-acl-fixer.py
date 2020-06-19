import os
from urllib.request import urlretrieve
import gzip
import logging
import pybtex.database
import sys

anthology_bibtex_filename = 'anthology.bib'
logger = logging.getLogger('root')
logging.basicConfig(level=logging.INFO)


def download_anthology_bibtex():
    anthology_bibtex_url = 'https://www.aclweb.org/anthology/anthology.bib.gz'
    logger.info('Downloading Anthology BibTeX')
    gzipped_bib_file, _ = urlretrieve(anthology_bibtex_url)
    logger.info('Download complete')
    with gzip.open(gzipped_bib_file, 'r') as f:
        bibtex_contents = [line.decode('utf-8') for line in f]
    with open(anthology_bibtex_filename, 'w', encoding='utf-8') as f:
        f.writelines(bibtex_contents)
    return ''.join(bibtex_contents)


def load_anthology_bibtex():
    if not os.path.exists(anthology_bibtex_filename):
        raw_bibtex = download_anthology_bibtex()
    else:
        with open(anthology_bibtex_filename, 'r', encoding='utf-8') as f:
            raw_bibtex = ''.join(f)

    logger.info('Parsing Anthology BibTeX (this may take a while)')
    return pybtex.database.parse_string(raw_bibtex, bib_format='bibtex')


def load_user_file(path):
    logger.info('Loading %s', path)
    return pybtex.database.parse_file(path, 'bibtex')


def find_candidate_ids(user_bibtex, anthology_bibtex):
    pass

def main():
    if len(sys.argv) <= 1:
        logger.error('Please supply the BibTeX file to translate')
        return
    filenames = sys.argv[1:]
    user_bibtex = [load_user_file(user_file) for user_file in filenames]

    bibtex = load_anthology_bibtex()
    anthology_title_to_key = {v.fields['title']: k for k, v in bibtex.entries.items()}



if __name__ == '__main__':
    main()