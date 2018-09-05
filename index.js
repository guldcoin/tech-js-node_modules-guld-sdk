const opn = require('opn')
const got = require('got')
const ncu = require('npm-check-updates')
const os = require('os')
const path = require('path')
const camelcase = require('lodash.camelcase')
const { getFS } = require('guld-fs')
const { getName, getAlias } = require('guld-user')
const spawn = require('guld-spawn').getSpawn()
var thisMetaPkg = {
  pkg: require(`${__dirname}/package.json`),
  eslintrc: require(`${__dirname}/.eslintrc.json`)
}
var fs

// TODO move this to flexfs and guld-fs
async function readThenClose (fpath, encoding) {
  fs = fs || await getFS()
  var stats = await fs.stat(fpath).catch(e => null)
  if (stats) {
    // open the file (getting a file descriptor to it)
    var fd = await fs.open(fpath, 'r').catch(e => null)
    if (fd) {
      var buffer = Buffer.alloc(stats.size)

      // read its contents into buffer
      await fs.read(fd, buffer, 0, buffer.length, null)
      await fs.close(fd)
      if (encoding) {
        if (encoding === 'json') return JSON.parse(buffer.toString('utf-8', 0, buffer.length))
        else return buffer.toString(encoding, 0, buffer.length)
      } else return buffer
    }
  }
}

function getPath (pname) {
  return path.join(os.homedir(), 'tech', 'js', 'node_modules', pname)
}

async function getMetaPkg () {
  if (!thisMetaPkg.hasOwnProperty('license') || !thisMetaPkg.hasOwnProperty('gitignore') || !thisMetaPkg.hasOwnProperty('travis')) {
    thisMetaPkg.license = await readThenClose(`${__dirname}/LICENSE`, 'utf-8')
    thisMetaPkg.gitignore = await readThenClose(`${__dirname}/.gitignore`, 'utf-8')
    thisMetaPkg.travis = await readThenClose(`${__dirname}/.travis.yml`, 'utf-8')
  }
  return thisMetaPkg
}

// TODO split this into dedicated packages
async function getServices (guser, pkg) {
  guser = guser || await getName()
  var gha = await getAlias(guser, 'github')
  var bba = await getAlias(guser, 'bitbucket')
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  return {
    npm: {
      name: 'node package manager',
      description: 'npm is the package manager for javascript',
      url: 'https://npmjs.org',
      activate: async () => true,
      badges: [
        {
          img: `https://img.shields.io/npm/v/${pkg.name}.svg`,
          url: `https://www.npmjs.com/package/${pkg.name}`
        }
      ]
    },
    travis: {
      name: 'travis-ci',
      description: 'Test and Deploy with Confidence.',
      url: 'https://travis-ci.org',
      activate: async function () {
        var url = `https://travis-ci.org/${gha}/tech-js-node_modules-${pkg.name}`
        try {
          await got(url)
        } catch (e) {
          await opn(url)
        }
      },
      badges: [
        {
          img: `https://travis-ci.org/${gha}/tech-js-node_modules-${pkg.name}.svg`,
          url: `https://travis-ci.org/${gha}/tech-js-node_modules-${pkg.name}?branch=${guser}`
        }
      ]
    },
    lgtm: {
      name: 'lgtm',
      description: 'Find and prevent zero-days and other critical bugs, with customizable alerts and automated code review.',
      url: 'https://lgtm.com',
      activate: async function () {
        try {
          await got(`https://lgtm.com/projects/b/${bba}/tech-js-node_modules-${pkg.name}`)
        } catch (e) {
          await opn('https://lgtm.com/dashboard')
        }
      },
      badges: [
        {
          img: `https://img.shields.io/lgtm/grade/javascript/b/${bba}/tech-js-node_modules-${pkg.name}.svg?logo=lgtm&logoWidth=18`,
          url: `https://lgtm.com/projects/b/${bba}/tech-js-node_modules-${pkg.name}/context:javascript`
        }
      ]
    },
    david: {
      name: 'david-dm',
      description: 'Watching your node.js dependencies.',
      url: 'https://david-dm.org',
      activate: async function () {
        var url = `https://david-dm.org/${gha}/tech-js-node_modules-${pkg.name}`
        try {
          await got(url)
        } catch (e) {
          await opn(url)
        }
      },
      badges: [
        {
          img: `https://david-dm.org/${gha}/tech-js-node_modules-${pkg.name}/status.svg`,
          url: `https://david-dm.org/${gha}/tech-js-node_modules-${pkg.name}`
        },
        {
          img: `https://david-dm.org/${gha}/tech-js-node_modules-${pkg.name}/dev-status.svg`,
          url: `https://david-dm.org/${gha}/tech-js-node_modules-${pkg.name}?type=dev`
        }

      ]
    }
  }
}

async function genBadges (guser, pkg) {
  fs = fs || await getFS()
  guser = guser || await getName()
  pkg = await gogetpkg(pkg)
  var services = await getServices(guser, pkg)
  var badges = `[![source](https://img.shields.io/badge/source-bitbucket-blue.svg)](${pkg.repository}) [![issues](https://img.shields.io/badge/issues-bitbucket-yellow.svg)](${pkg.repository}/issues) [![documentation](https://img.shields.io/badge/docs-guld.tech-green.svg)](${pkg.homepage})

[![node package manager](https://img.shields.io/npm/v/${pkg.name}.svg)](https://www.npmjs.com/package/${pkg.name})`
  Object.keys(services).forEach(s => {
    if (s !== 'npm') {
      services[s].badges.forEach(b => {
        badges = `${badges} [![${services[s].name}](${b.img})](${b.url})`
      })
    }
  })
  return `${badges}

`.replace('\n\n\n', '\n\n')
}

async function genReadme (pkg, readme) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  var license = `### License

${pkg.license} Copyright ${pkg.author}
`
  readme = readme || await readThenClose(`${process.cwd()}/README.md`, 'utf-8')
  if (readme.indexOf('### License') === -1) {
    readme = `${readme}

${license}`.replace(/\n\n\n/g, '\n\n')
  }
  var bdgs = await genBadges()
  var install = `### Install

`
  if (pkg.main || pkg.bin) {
    install = `${install}##### Node

\`\`\`sh
npm i ${pkg.preferGlobal ? '-g ' : ''}${pkg.name}
\`\`\`

`
  }
  if (pkg.browser) {
    install = `${install}##### Browser

\`\`\`sh
curl ${pkg.repository.replace(':', '/').replace(`git@`, 'https://')}/raw/guld/${pkg.browser} -o ${pkg.browser}
\`\`\`

`
  }
  var usage = `### Usage

`
  if (pkg.bin) {
    var halp = await new Promise(resolve => {
      require(path.join(getPath(pkg.name), 'cli.js')).outputHelp(resolve)
    })
    usage = `${usage}##### CLI

\`\`\`sh
${Object.keys(pkg.bin)[0]} --help

${halp}\`\`\`
`
  } else if (typeof (readme) === 'undefined') {
    usage = `${usage}##### node

\`\`\`javascript
require('${pkg.name}')
\`\`\`
`
  } else {
    var re = new RegExp('#{1,3} Usage[#\\s\\w=+*,(){}\\[\\]!<>&?$`"\'.\\/:@-]*(?=(\\n#{1,3} ))')
    var usages = re.exec(readme)
    if (usages) usage = re.exec(readme)[0].replace(/#{1,2}$/, '').replace('\n#\n', '\n')
    else usage = ''
  }

  return `# ${pkg.name}

${bdgs}
${pkg.description}

${install}
${usage}
${license}`.replace(/\n\n\n/g, '\n\n')
}

function isCLI (pname) {
  return pname.endsWith('-cli')
}

function isSDK (pname) {
  return pname.startsWith('guld-sdk')
}

function isApp (pname) {
  return pname.endsWith('-app')
}

function getHomepage (pname) {
  if (isCLI(pname)) return `https://guld.tech/cli/${pname}.html`
  else return `https://guld.tech/lib/${pname}.html`
}

function getRepository (pname, bba) {
  return `https://bitbucket.org/${bba}/tech-js-node_modules-${pname}`
}

async function genPackage (guser, pkg) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  guser = guser || await getName()
  var bba = await getAlias(guser, 'bitbucket')
  pkg.readme = 'README.md'
  pkg.author = pkg.author || guser
  pkg.license = pkg.license || 'MIT'
  pkg.description = pkg.description || `${pkg.name} by ${pkg.author}`
  pkg.version = pkg.version || '0.0.0'
  pkg.engines = pkg.engines || { 'node': '>=7' }
  pkg.scripts = pkg.scripts || {}
  if (!pkg.scripts.hasOwnProperty('test')) pkg.scripts['test'] = 'mocha test/*.js'
  if (!pkg.scripts.hasOwnProperty('lint')) pkg.scripts['lint'] = 'eslint *.js* test/*.js'
  if (!pkg.scripts.hasOwnProperty('fix')) pkg.scripts['fix'] = 'eslint --fix *.js* test/*.js'
  if (!pkg.scripts.hasOwnProperty('test')) pkg.scripts['test'] = 'eslint --fix *.js* test/*.js'
  if (!pkg.scripts.hasOwnProperty('test:lint')) pkg.scripts['test:lint'] = 'npm run lint && npm run test'
  pkg.dependencies = pkg.dependencies || {}
  pkg.devDependencies = pkg.devDependencies || {}
  // these hard coded versions will be updated by npm update
  if (!pkg.devDependencies.hasOwnProperty('chai')) pkg.devDependencies.chai = '^4.1.2'
  if (!pkg.devDependencies.hasOwnProperty('mocha')) pkg.devDependencies.mocha = '^5.2.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint')) pkg.devDependencies.eslint = '^4.1.2'
  if (!pkg.devDependencies.hasOwnProperty('eslint-config-standard')) pkg.devDependencies['eslint-config-standard'] = '^12.0.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint-plugin-import')) pkg.devDependencies['eslint-plugin-import'] = '^2.14.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint-plugin-node')) pkg.devDependencies['eslint-plugin-node'] = '^7.0.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint-plugin-promise')) pkg.devDependencies['eslint-plugin-promise'] = '^4.0.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint-plugin-standard')) pkg.devDependencies['eslint-plugin-standard'] = '^4.0.0'
  if (!pkg.devDependencies.hasOwnProperty('eslint-plugin-json')) pkg.devDependencies['eslint-plugin-json'] = '^1.2.1'
  if (!pkg.devDependencies.hasOwnProperty('pre-commit')) pkg.devDependencies['pre-commit'] = '^1.2.2'
  pkg.homepage = getHomepage(pkg.name)
  pkg.repository = getRepository(pkg.name, bba)
  pkg.keywords = pkg.keywords || ['guld']
  if (pkg.keywords.indexOf('guld') === -1) pkg.keywords.push('guld')
  if (pkg.browser && pkg.keywords.indexOf('browser') === -1) pkg.keywords.push('browser')
  if (pkg.main && pkg.keywords.indexOf('node') === -1) pkg.keywords.push('node')
  if (isCLI(pkg.name)) {
    if (pkg.keywords.indexOf('cli') === -1) pkg.keywords.push('cli')
    if (pkg.keywords.indexOf('node') === -1) pkg.keywords.push('node')
    pkg.bin = {}
    pkg.bin[pkg.name.replace('-cli', '')] = 'cli.js'
    delete pkg.main
    delete pkg.browser
  } else if (isApp(pkg.name)) {
    if (pkg.keywords.indexOf('app') === -1) pkg.keywords.push('app')
    pkg.scripts.preinstall = 'npm link mochify; npm link puppeteer'
    if (!pkg.devDependencies.hasOwnProperty('mochify')) pkg.devDependencies['mochify'] = '^5.8.1'
    if (!pkg.devDependencies.hasOwnProperty('puppeteer')) pkg.devDependencies['puppeteer'] = '^1.7.0'
  } else {
    if (pkg.keywords.indexOf('node') >= 0) {
      pkg.main = pkg.main || 'index.js'
    } else if (pkg.main) delete pkg.main
    if (pkg.keywords.indexOf('browser') >= 0) {
      pkg.browser = pkg.browser || `${pkg.name}.min.js`
      pkg.scripts.build = 'webpack'
      if (!pkg.devDependencies.hasOwnProperty('webpack')) pkg.devDependencies['webpack'] = '^4.17.2'
      if (!pkg.devDependencies.hasOwnProperty('mochify')) pkg.devDependencies['mochify'] = '^5.8.1'
      if (!pkg.devDependencies.hasOwnProperty('puppeteer')) pkg.devDependencies['puppeteer'] = '^1.7.0'
      pkg.eslintIgnore = pkg.eslintIgnore || []
      if (pkg.eslintIgnore.indexOf('*.min.js') === -1) pkg.eslintIgnore.push('*.min.js')
    } else if (pkg.browser) delete pkg.browser
  }
  if (isSDK(pkg.name)) {
    if (pkg.keywords.indexOf('sdk') === -1) pkg.keywords.push('sdk')
  }
  pkg['pre-commit'] = pkg['pre-commit'] || ['test:lint']
  return pkg
}

async function genEslint (pkg, rc) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  rc = rc || await readThenClose(`${process.cwd()}/.eslintrc.json`, 'json').catch(e => { return {} }) || {}
  rc.extends = rc.extends || []
  if (rc.extends.indexOf('eslint:recommended') === -1) rc.extends.push('eslint:recommended')
  if (rc.extends.indexOf('standard') === -1) rc.extends.push('standard')
  rc.plugins = rc.plugins || []
  if (rc.plugins.indexOf('json') === -1) rc.plugins.push('json')
  rc.rules = rc.rules || {}
  if (!rc.rules.hasOwnProperty('linebreak-style')) rc.rules['linebreak-style'] = ['error', 'unix']
  if (!rc.rules.hasOwnProperty('camelcase')) rc.rules['camelcase'] = ['error', { 'properties': 'always' }]
  if (!rc.rules.hasOwnProperty('prefer-template')) rc.rules['prefer-template'] = 'error'
  if (isCLI(pkg.name)) {
    rc.globals = rc.globals || {}
    var cc = camelcase(pkg.name)
    if (!rc.globals.hasOwnProperty(cc)) rc.rules[cc] = false
  }
  return rc
}

async function genTravis (pkg) {
  pkg = await gogetpkg(pkg)
  thisMetaPkg = await getMetaPkg()
  return await readThenClose(`${process.cwd()}/.travis.yml`, 'utf-8').catch(e => { return thisMetaPkg.travis.replace(/guld-sdk/g, pkg.name) }) || thisMetaPkg.travis.replace(/guld-sdk/g, pkg.name)
}

async function genLicense (guser) {
  guser = guser || await getName()
  var defaultLicense = (await getMetaPkg()).license.replace(/Copyright.*/, `Copyright (c) ${(new Date()).getFullYear()} ${guser}`)
  return await readThenClose(`${process.cwd()}/LICENSE`, 'utf-8').catch(e => { return defaultLicense }) || defaultLicense
}

async function genGitignore () {
  thisMetaPkg = await getMetaPkg()
  return await readThenClose(`${process.cwd()}/.gitignore`, 'utf-8').catch(e => { return thisMetaPkg.gitignore }) || thisMetaPkg.gitignore
}

async function genNpmignore () {
  return await readThenClose(`${process.cwd()}/.npmignore`, 'utf-8').catch(e => 'test\n*.min.js\n') || 'test\n*.min.js\n'
}

async function genWepack (pkg) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  var defaultCfg = `module.exports = [
  {
    mode: 'production',
    target: 'web',
    entry: {
      index: './index.js'
    },
    output: {
      filename: '${pkg.name}.min.js',
      path: __dirname,
      library: '${camelcase(pkg.name)}',
      libraryTarget: 'var'
    }
  }
]
`
  return await readThenClose(`${process.cwd()}/webpack.config.js`, 'utf-8').catch(e => { return defaultCfg }) || defaultCfg
}

async function init (guser, pkg) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  guser = guser || await getName()
  var pdir = getPath(pkg.name)
  await fs.mkdirp(path.join(pdir, 'test'))
  if ((await fs.readdir(path.join(pdir, 'test'))).length === 0) await fs.writeFile(path.join(pdir, 'test', 'test.js'), ``)
  await spawn('git', '', ['init'], true)
  await spawn('guld-git-remote', '', ['delete'], true)
  await spawn('guld-git-remote', '', ['add'], true)
  await spawn('git', '', ['checkout', '-b', guser], true)
  await spawn('git', '', ['checkout', guser], true)
  await spawn('guld-git-host', '', ['-u', guser, 'repo-create'], true)
  pkg = await genPackage(guser, pkg)
  await fs.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
  await fs.writeFile('.eslintrc.json', `${JSON.stringify(await genEslint(pkg), null, 2)}\n`)
  await fs.writeFile('README.md', await genReadme(pkg))
  await fs.writeFile('.travis.yml', await genTravis(pkg))
  await fs.writeFile('LICENSE', await genLicense(guser))
  await fs.writeFile('.gitignore', await genGitignore())
  await fs.writeFile('.npmignore', await genNpmignore())
  if (pkg.keywords.indexOf('browser') !== -1 || pkg.browser) await fs.writeFile('webpack.config.js', await genWepack(pkg))
  var status = (await spawn('git', '', ['status', '-s'], true)).trim()
  if (status.indexOf('package.json') !== -1 ||
      status.indexOf('README.md') !== -1 ||
      status.indexOf('.travis.yml') !== -1 ||
      status.indexOf('.gitignore') !== -1 ||
      status.indexOf('.npmignore') !== -1 ||
      status.indexOf('.eslintrc.json') !== -1 ||
      status.indexOf('test/') !== -1 ||
      status.indexOf('webpack.json') !== -1) {
    await spawn('git', '', ['add', 'package.json', 'README.md', 'test', '.travis.yml', 'LICENSE', '.gitignore', '.npmignore', '.eslintrc.json'], true)
    await spawn('git', '', ['commit', '-m', 'init'], true)
    await spawn('git', '', ['push', guser, guser], true)
  }
  var services = await getServices(guser, pkg)
  await Promise.all(Object.keys(services).map(s => services[s].activate()))
  return pkg
}

async function version (guser, pkg, level = 'patch') {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  guser = guser || await getName()
  await spawn('npm', '', ['version', level], true)
  await publish(guser, pkg)
}

async function publish (guser, pkg) {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  guser = guser || await getName()
  var bba = await getAlias(guser, 'bitbucket')
  await spawn('npm', '', ['publish'], true)
  await spawn('git', '', ['push', guser, guser], true)
  process.chdir(getPath(''))
  await spawn('git', '', ['init'], true)
  await spawn('git', '', ['submodule', 'add', `https://bitbucket.org/${bba}/tech-js-node_modules-${pkg.name}`, pkg.name], true)
  await spawn('git', '', ['submodule', 'set-url', `https://bitbucket.org/${bba}/tech-js-node_modules-${pkg.name}`, pkg.name], true)
  await spawn('git', '', ['add', pkg.name], true)
  await spawn('git', '', ['commit', '-m', `update ${pkg.name}`], true)
  await spawn('git', '', ['push', guser, guser], true)
  process.chdir(getPath('guld-docs'))
  await spawn('npm', '', ['run', 'build-tech'], true)
  process.chdir(path.join(os.homedir(), 'io', 'http', 'guld.tech'))
  await spawn('git', '', ['add', '-A'], true)
  await spawn('git', '', ['commit', '-m', `built ${pkg.name}`], true)
  await spawn('git', '', ['push', guser, guser], true)
}

async function deprecate (guser, pkg, message = 'No longer maintained.') {
  fs = fs || await getFS()
  pkg = await gogetpkg(pkg)
  guser = guser || await getName()
  pkg = await genPackage(guser, pkg)
  if (pkg.description.indexOf('DEPRECATED') === -1) {
    pkg.description = `DEPRECATED ${message}\n\n${pkg.description}`
    await fs.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
    await fs.writeFile('README.md', await genReadme(pkg))
    await spawn('git', '', ['add', 'package.json', 'README.md'], true)
    await spawn('git', '', ['commit', '-m', 'deprecated'], true)
    await spawn('git', '', ['push', guser, guser], true)
  }
  await spawn('npm', '', ['deprecate', pkg.name, message], true)
}

async function upgrade (pkg) {
  pkg = await gogetpkg(pkg)
  var upgraded = await ncu.run({
    packageFile: 'package.json',
    silent: true,
    jsonUpgraded: true,
    upgrade: true
  })
  await spawn('npm', '', ['upgrade'], true)
  await spawn('git', '', ['add', 'package.json'], true)
  await spawn('git', '', ['commit', '-m', 'upgrade deps'], true)
  return upgraded
}

async function gogetpkg (pkg) {
  fs = fs || await getFS()
  if (pkg && pkg.name && typeof pkg.name === 'string') {
    var gpath = getPath(pkg.name)
    return readThenClose(`${gpath}/package.json`, 'json').then(async pack => {
      if (pack) {
        process.chdir(gpath)
        return pack
      } else {
        await fs.mkdirp(gpath)
        process.chdir(gpath)
        return pkg
      }
    }).catch(async e => {
      await fs.mkdirp(gpath)
      process.chdir(gpath)
      return pkg
    })
  } else {
    var pname = process.cwd().replace(getPath(''), '').replace('/', '')
    return gogetpkg({ name: pname })
  }
}

module.exports = {
  getPath: getPath,
  gogetpkg: gogetpkg,
  getMetaPkg: getMetaPkg,
  genBadges: genBadges,
  genReadme: genReadme,
  genPackage: genPackage,
  genEslint: genEslint,
  genTravis: genTravis,
  genLicense: genLicense,
  genGitignore: genGitignore,
  genNpmignore: genNpmignore,
  init: init,
  version: version,
  publish: publish,
  deprecate: deprecate,
  upgrade: upgrade,
  readThenClose: readThenClose
}
