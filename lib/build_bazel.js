'use babel';

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import voucher from 'voucher';
import { EventEmitter } from 'events';

export const config = {
  bazelCommand: {
    title: 'Bazel command',
    description: 'The Bazel command to execute the build. Use <code>build</code> for just building, use <code>test</code> for building and running tests.',
    type: 'string',
    default: "build"
  },
  bazelExecutable: {
    title: 'Bazel executable',
    description: 'The Bazel executable. Defaults to <code>bazel</code>.',
    type: 'string',
    default: "bazel"
  },
  targetFilter: {
    title: 'Target extraction query',
    description: 'Use <code>\':all\'</code> to extract all targets. Use <code>\'kind(\".*test\", :all)\'</code> for test targets. See <code>$ bazel help query</code> for details.',
    type: 'string',
    default: "':all'",
  }
};


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
      const args = [ atom.config.get('build-bazel.bazelCommand') ];

      const defaultTarget = {
        exec: atom.config.get('build-bazel.bazelExecutable'),
        name: 'Bazel: default (no target)',
        args: args,
        sh: false,
        errorMatch: errorMatch,
        warningMatch: warningMatch
      };

      const promise = voucher(
        exec,
        `${ atom.config.get('build-bazel.bazelExecutable') } query ${ atom.config.get('build-bazel.targetFilter') }`,
        { cwd: this.cwd })

      return promise.then(output => {
        return [ defaultTarget ].concat(output.toString('utf8')
          .split(/[\r\n]{1,2}/)
          .filter(line => line.length > 0)
          .filter(line => !/INFO: Empty results/.test(line))
          .map(target => ({
            exec: atom.config.get('build-bazel.bazelExecutable'),
            args: args.concat([ target ]),
            name: `Bazel: ${target}`,
            sh: false,
            errorMatch: errorMatch,
            warningMatch: warningMatch
          })));
      }).catch(e => {
        atom.notifications.addWarning(e.toString());
        return [ defaultTarget ]
      });
    }
  };
}
