/**
 * Manual debug script — run with:
 *   node tests/utils/manual.mjs
 *
 * Requires a build first: npm run build
 */
import { getLanguageService } from '../../dist/index.js'

const ls = getLanguageService()

const xml = `<definitions xmlns="http://ws.apache.org/ns/synapse">
  <api name="OrderAPI" context="/orders">
    <resource methods="GET POST">
      <inSequence>
        <log level="custom"/>
        <send/>
      </inSequence>
      <outSequence>
        <respond/>
      </outSequence>
    </resource>
  </api>
  <sequence name="ErrorHandler">
    <log/>
    <respond/>
  </sequence>
</definitions>`

const doc = ls.parseXMLDocument('file:///test.xml', xml)

console.log('=== printTreeAST ===')
console.log(ls.printTreeAST(doc))

// console.log('\n=== printAST ===')
// console.log(ls.printAST(doc))

// console.log('\n=== printAST (with positions) ===')
// console.log(ls.printAST(doc, { includePositions: true }))

// console.log('\n=== printCST ===')
// console.log(ls.printCST(doc))
