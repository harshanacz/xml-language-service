import { getLanguageService } from './dist/index.js'

const service = getLanguageService()

// test with pom.xml content
const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  
</project>`

const doc = service.parseXMLDocument('file:///test/pom.xml', pomXml)

// test completion at position where we typed '<'
const completions = service.doComplete(doc, { line: 4, character: 3 })
console.log('=== COMPLETIONS ===')
console.log('Total items:', completions.items.length)
console.log('First 5:', completions.items.slice(0, 5).map(i => i.label))

// test hover on 'project' tag
const hover = service.doHover(doc, { line: 1, character: 3 })
console.log('\n=== HOVER ===')
console.log(hover?.contents ?? 'no hover')

