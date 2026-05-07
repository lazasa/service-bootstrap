// Map a test file to the source files it covers. Add one branch per
// resource; tests outside any resource get no source attribution.
module.exports = (testFile) => {
  if (testFile.includes('items')) {
    return [
      'src/api/items/items.service.ts',
      'src/api/items/items.repository.ts',
      'src/api/items/items.routes.ts'
    ]
  }
  return []
}
