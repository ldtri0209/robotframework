# Automatically generated by 'package.py' script.

VERSION = 'trunk'
RELEASE = '20080806'
TIMESTAMP = '20080806-163529'

def get_version(sep=' '):
    if RELEASE == 'final':
        return VERSION
    return VERSION + sep + RELEASE

if __name__ == '__main__':
    import sys
    print get_version(*sys.argv[1:])
