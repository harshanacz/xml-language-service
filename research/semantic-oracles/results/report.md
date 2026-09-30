# Semantic oracle campaign

Generated documents: 300. Documents violating at least one oracle: 155.

| Oracle | Family | Failing documents | What it checks |
| --- | --- | --- | --- |
| GT-DEF-OPEN-TO-CLOSE | ground-truth | 99 | Go-to-definition on an opening tag must land on that element's own closing tag. |
| GT-REF-COUNT | ground-truth | 0 | Find-references on a tag must return exactly the elements with that name. |
| GT-RENAME-EXACT | ground-truth | 0 | Renaming a tag must change exactly that element's opening and closing names. |
| MR-DEF-ROUNDTRIP | metamorphic | 97 | def(def(p)) must return to the tag p started on (open -> close -> open). |
| MR-REF-CONSISTENT | metamorphic | 0 | Find-references from any occurrence of the same name must return the same set. |
| MR-RENAME-INVERSE | metamorphic | 0 | rename(a -> b) followed by rename(b -> a) must restore the original document. |
| MR-FMT-IDEMPOTENT | metamorphic | 0 | format(format(x)) must equal format(x). |
| MR-FMT-PRESERVES-CONTENT | metamorphic | 48 | Formatting may change layout only: names, attributes, text and CDATA must survive. |
| MR-EOL-INVARIANT | metamorphic | 0 | LF and CRLF versions of a document must give identical line/character results. |
| MR-LINE-SHIFT | metamorphic | 0 | Prepending 3 blank lines must shift every result down by exactly 3 lines. |
| DIFF-MATCHING-TAG | differential | 47 | Go-to-definition target must agree with the HTML service's findMatchingTagPosition. |
| DIFF-FOLDING | differential | 42 | Folding start lines must agree with the HTML service (regions spanning 3+ lines, and comments). |

## GT-DEF-OPEN-TO-CLOSE

Go-to-definition on an opening tag must land on that element's own closing tag.

Seed 9: <ns:xy> at 0:1: expected 0:22, got 0:14

```xml
<ns:xy><ns:xy></ns:xy></ns:xy>
```

Seed 1: <a> at 0:1: expected 0:27, got 0:14

```xml
<a><items><ab></ab></items></a>
```

Seed 8: <ns:x> at 0:1: expected 2:0, got 1:9

```xml
<ns:x>
  <ns:xy></ns:xy>
</ns:x>
```

## MR-DEF-ROUNDTRIP

def(def(p)) must return to the tag p started on (open -> close -> open).

Seed 9: <ns:xy>: open 0:0 -> 0:14 -> 0:7

```xml
<ns:xy><ns:xy></ns:xy></ns:xy>
```

Seed 1: <a>: open 0:0 -> 0:14 -> 0:10

```xml
<a><items><ab></ab></items></a>
```

Seed 8: <ns:x>: open 0:0 -> 1:9 -> 1:2

```xml
<ns:x>
  <ns:xy></ns:xy>
</ns:x>
```

## DIFF-MATCHING-TAG

Go-to-definition target must agree with the HTML service's findMatchingTagPosition.

Seed 40: <items> at 0:1: html 0:24, xml 0:16

```xml
<items><items></items></items>
```

Seed 8: <ns:x> at 0:1: html 2:2, xml 1:11

```xml
<ns:x>
  <ns:xy></ns:xy>
</ns:x>
```

Seed 26: <b> at 0:1: html 2:2, xml 1:20

```xml
<b>␍
	<!-- <b>not a tag</b> -->␍
</b>␍
```

## DIFF-FOLDING

Folding start lines must agree with the HTML service (regions spanning 3+ lines, and comments).

Seed 56: xml [region@0] vs html [comment@1 region@0]

```xml
<a>
  <!--x
y-->
</a>
```

Seed 33: xml [region@0] vs html [comment@1 region@0]

```xml
<ns:x>
	<!--x
y-->
</ns:x>
```

Seed 8: xml [] vs html [comment@0]

```xml
<!-- multi
   line
 comment -->
<b></b>
```

## MR-FMT-PRESERVES-CONTENT

Formatting may change layout only: names, attributes, text and CDATA must survive.

Seed 9: content differs at event 1: cdata("x\ny") vs cdata("x\n  y")

```xml
<ab><![CDATA[x
y]]></ab>
```

Seed 52: content differs at event 1: cdata("x\ny") vs cdata("x\n  y")

```xml
<a>␍
	<![CDATA[x␍
y]]>␍
</a>␍
```

Seed 53: content differs at event 1: cdata("x\ny") vs cdata("x\n  y")

```xml
<ab>␍
    <![CDATA[x␍
y]]>␍
</ab>␍
```

(␍ marks a CRLF line ending.)
