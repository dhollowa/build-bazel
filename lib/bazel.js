'use babel';

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import voucher from 'voucher';
import { EventEmitter } from 'events';

export function provideBuilder() {
  const gccErrorMatch = '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):' +
    '(?<line>\\d+):(?<col>\\d+):\\s*(fatal error|error):\\s*(?<message>.+)';
  const ocamlErrorMatch = '(?<file>[\\/0-9a-zA-Z\\._\\-]+)", line (?<line>\\d+), ' +
    'characters (?<col>\\d+)-(?<col_end>\\d+):\\n(?<message>.+)';
  const golangErrorMatch = '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):' +
    '(?<line>\\d+):\\s*(?<message>.*error.+)';
  const errorMatch = [
    gccErrorMatch, ocamlErrorMatch, golangErrorMatch
  ];

  const gccWarningMatch = '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):(?<col>\\d+):' +
    '\\s*(warning):\\s*(?<message>.+)';
  const warningMatch = [
    gccWarningMatch
  ];

  return class BazelBuildProvider extends EventEmitter {
    constructor(cwd) {
      super();
      this.cwd = cwd;
    }

    getNiceName() {
      return 'Bazel';
    }

    isEligible() {
      this.files = [ 'BUILD' ]
        .map(f => path.join(this.cwd, f))
        .filter(fs.existsSync);
      return this.files.length > 0;
    }

    settings() {
      const args = [ "build" ];

      const defaultTarget = {
        exec: 'bazel',
        name: 'Bazel: default (no target)',
        args: args,
        sh: false,
        errorMatch: errorMatch,
        warningMatch: warningMatch
      };

      const promise = voucher(exec, 'bazel query :all', { cwd: this.cwd })

      return promise.then(output => {
        return [ defaultTarget ].concat(output.toString('utf8')
          .split(/[\r\n]{1,2}/)
          .filter(line => line.length > 0)
          .filter(line => !/INFO: Empty results/.test(line))
          .map(target => ({
            exec: 'bazel',
            args: args.concat([ target ]),
            name: `Bazel: ${target}`,
            sh: false,
            errorMatch: errorMatch,
            warningMatch: warningMatch
          })));
      }).catch(e => [ defaultTarget ]);
    }
  };
}
