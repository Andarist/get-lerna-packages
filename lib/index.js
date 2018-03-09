'use strict'

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const LERNA_JSON = 'lerna.json'
const PACKAGE_JSON = 'package.json'
const DEFAULT_PACKAGES_GLOB = 'packages/*'

const flatMap = (iteratee, arr) => [].concat(...arr.map(iteratee))

const findRoot = directory => {
  const configPath = path.join(directory, LERNA_JSON)

  if (fs.existsSync(configPath)) {
    return directory
  }

  return findRoot(path.join(directory, '..'))
}

const readJSONFile = file => JSON.parse(fs.readFileSync(file))

// https://github.com/lerna/lerna/blob/4f95be87ff9179a8f370982b963cf3d0be925332/src/PackageUtilities.js#L46
const getPackages = (packageConfigs, rootPath) => {
  const packages = []
  const globOpts = {
    cwd: rootPath,
    strict: true,
    absolute: true,
  }

  const hasNodeModules = packageConfigs.some(cfg => cfg.indexOf('node_modules') > -1)
  const hasGlobStar = packageConfigs.some(cfg => cfg.indexOf('**') > -1)

  if (hasGlobStar) {
    if (hasNodeModules) {
      const message = 'An explicit node_modules package path does not allow globstars (**)'
      throw new Error(message)
    }

    globOpts.ignore = [
      // allow globs like "packages/**",
      // but avoid picking up node_modules/**/package.json
      '**/node_modules/**',
    ]
  }

  return flatMap(
    globPath =>
      glob.sync(path.join(globPath, PACKAGE_JSON), globOpts).map(globResult => {
        // https://github.com/isaacs/node-glob/blob/master/common.js#L104
        // glob always returns "\\" as "/" in windows, so everyone
        // gets normalized because we can't have nice things.
        const packageConfigPath = path.normalize(globResult)
        return path.dirname(packageConfigPath)
      }),
    packageConfigs
  )
}

module.exports = (directory = process.cwd()) => {
  const rootDirectory = findRoot(directory)
  const lernaConfig = readJSONFile(path.join(rootDirectory, LERNA_JSON))

  const workspaces = lernaConfig.useWorkspaces && readJSONFile(path.join(rootDirectory, PACKAGE_JSON)).workspaces
  const packages = workspaces || lernaConfig.packages || DEFAULT_PACKAGES_GLOB
  return getPackages(packages, rootDirectory)
}
