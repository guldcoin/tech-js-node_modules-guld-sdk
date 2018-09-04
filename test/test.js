/* eslint-env mocha */
process.env.GULDNAME = 'guld'
const chai = require('chai')
const guldSDK = require('../')
var realReadme
var thisMetaPkg

describe('guld-sdk', function () {
  before(async () => {
    realReadme = await guldSDK.readThenClose('README.md', 'utf-8')
  })
  it('getMetaPkg', async function () {
    thisMetaPkg = await guldSDK.getMetaPkg()
    chai.assert.exists(thisMetaPkg.pkg)
    chai.assert.exists(thisMetaPkg.pkg.name)
    chai.assert.exists(thisMetaPkg.eslintrc)
    chai.assert.exists(thisMetaPkg.eslintrc.plugins)
    chai.assert.exists(thisMetaPkg.license)
    chai.assert.exists(thisMetaPkg.travis)
    chai.assert.exists(thisMetaPkg.gitignore)
    chai.assert.isAbove(thisMetaPkg.license.length, 0)
    chai.assert.isAbove(thisMetaPkg.travis.length, 0)
    chai.assert.isAbove(thisMetaPkg.gitignore.length, 0)
  })
  it('genBadges', async function () {
    var badges = await guldSDK.genBadges('guld')
    var re = new RegExp('\\[\\!\\[source\\]\\(https\\:.*\\n\\n.*')
    chai.assert.equal(badges, `${re.exec(realReadme)[0]}

`)
  })
  it('genReadme', async function () {
    var readme = await guldSDK.genReadme()
    chai.assert.equal(realReadme, readme)
  })
  it('genPackage', async function () {
    var pkg = await guldSDK.genPackage()
    chai.assert.deepEqual(thisMetaPkg.pkg, pkg)
  })
  it('genEslint', async function () {
    var eslintrc = await guldSDK.genEslint()
    chai.assert.deepEqual(thisMetaPkg.eslintrc, eslintrc)
  })
  it('genTravis', async function () {
    var travis = await guldSDK.genTravis()
    chai.assert.deepEqual(thisMetaPkg.travis, travis)
  })
  it('genLicense', async function () {
    var license = await guldSDK.genLicense()
    chai.assert.exists(new RegExp('Copyright \\(c\\).*').exec(license))
  })
  it('genGitignore', async function () {
    var gitignore = await guldSDK.genGitignore()
    chai.assert.deepEqual(thisMetaPkg.gitignore, gitignore)
  })
  it('genNpmignore', async function () {
    var npmignore = await guldSDK.genNpmignore()
    chai.assert.exists(new RegExp('.*test\\n\\*\\.min\\.js\\n.*').exec(npmignore))
  })
  /* it('init', async function () {
    await guldSDK.init('guld', 'guld-xyz')
  }) */
})
