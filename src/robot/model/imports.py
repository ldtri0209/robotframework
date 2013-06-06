#  Copyright 2008-2012 Nokia Siemens Networks Oyj
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import os

from itemlist import ItemList


class Import(object):
    ALLOWED_TYPES = ('Library', 'Resource', 'Variables')

    def __init__(self, type, name, args=(), alias=None, source=None):
        if type not in self.ALLOWED_TYPES:
            raise ValueError('Invalid import type. Should be either %s or %s' %
                             (', '.join(self.ALLOWED_TYPES[:-1]),
                              self.ALLOWED_TYPES[-1]))
        self.type = type
        self.name = name
        self.args = args
        self.alias = alias
        self.source = source

    @property
    def directory(self):
        if not self.source:
            return None
        if os.path.isdir(self.source):
            return self.source
        return os.path.dirname(self.source)

    def report_invalid_syntax(self, message, level='ERROR'):
        from robot.output import LOGGER
        # TODO: Remove table information from error message here and
        # also from _TestData.report_invalid_syntax in parsing/model.py
        LOGGER.write("Error in file '%s' in table 'Settings': %s"
                     % (self.source or '<unknown>', message), level)


class Imports(ItemList):

    def __init__(self, source, imports=None):
        ItemList.__init__(self, Import, {'source': source}, items=imports)

    def library(self, name, args=(), alias=None):
        self.create('Library', name, args, alias)

    def resource(self, path):
        self.create('Resource', path)

    def variables(self, path, args=()):
        self.create('Variables', path, args)
