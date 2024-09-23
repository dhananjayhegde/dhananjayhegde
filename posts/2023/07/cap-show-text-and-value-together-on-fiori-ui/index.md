---
title: "CAP - Show text and value together on Fiori UI"
date: "2023-07-30"
categories:
  - "cap"
  - "sap"
tags:
  - "annotation"
  - "cap"
  - "cloud-application-programming"
  - "text"
  - "textarrangement"
excerpt: How to show text for a code on Fiori Elements applications using annotations in CAP model.
---

If you want to achieve something like below, here is how you can do it with CAP annotations:

![image.png](/static/img/2023/07/image.png)

Here, we hvae the code/value "2" and the text displayed before that. This text could also be localized.

This is achieved with the help of two annotaions from Commons vocabulary.

```abap
@Common.Text
@Common.TextArrangement
```

Both these annotations should be assigned to the code/value field. In our csae, we have the entity "Result" which is extending the built-in asepct @sap.common.CodeList

```js
entity Result : sap.common.CodeList {
  key code : Integer;
}
```

This gives us an advantage. We get two predefined fields `name` and `descr` . Refer to how [@sap.common.CodeList](https://cap.cloud.sap/docs/cds/common#code-lists) is defined.

Now, within CDS annotaiton file (literally any file with exension .cds inside your db/ folder next to schema.cds file, add the below annotation

```abap
annotate golf.Result with {
    code @(
        Common.Text: name,
        Common.TextArrangement: #TextFirst
    );
}

```

`code` is the field name that contains the values `1`, `2` etc. `name` and `descr` are from sap.common.CodeList aspect.

[GitHub Repo](https://github.com/dhananjayhegde/CAPDevChallengeJuly2023/blob/main/db/schema-annotations.cds) which you can clone to see this in action.
