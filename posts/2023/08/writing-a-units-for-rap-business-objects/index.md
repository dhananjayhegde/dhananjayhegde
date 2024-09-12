---
title: "Writing A Units for RAP Business Objects"
date: "2023-08-12"
categories: 
  - "abap"
  - "sap"
tags: 
  - "aunits"
  - "rap"
  - "sap"
  - "testing"
---

You have developed a business object and now you want to write ABAP Unit tests for it. But before you jump into it, you should decide " what is that you want to achieve from doing so"?

# Motivation

- To ensure different parts of RAP business objects are tested

- To achieve code coverage and test edge cases

# Aspects

There are different aspects to testing RAP Business Objects:

1. Test each method (determination, validation, action, CRUD methods) individually by mocking EMLs and any other dependencies

3. Test the draft behavior by mocking databases dependencies

## Test each methods individually

In this case, you will trigger the methods by

- first instatiating local handler classes

- mocking EML statements using `CL_ABAP_BEHV_TESTDOUBLE` class

- then calling the method individually

In this method, since the EMLs are mocked, they will not trigger other determinations or validations. This way you are able to test each method in an isolated manner.

## Test business object behavior

In this method, you will test the behavior by

- mocking the database artifacts such as tables, CDS views etc

- mocking external dependencies such as classes/APIs

- then triggering the test using EMLs

In this method, you are able to test the business object behavior by triggering different determinanations and validations i.e.

Suppose,

- determination `SetNetprice` is triggered `Material` field is changed and it updates the field `NetPrice`

- determination `CalculateNetAmount`  is triggered when `NetPrice` or `Quantity` field is changed

Now, if you write a test that executes an EML something like this:

```
MODIFY ENTITIES OF MySampleBO 
   ENTITY MySampleRootEntity 
       UPDATE FIELDS ( Material ) 
       FROM VALUE #( ( %key-KeyField = '12345' 
                        Material     = 'MaterialB' ) ) 
   FAILED DATA(ls_failed).
```

This would trigger determination SetNetPrice and then CalculateNetAmount.

You may then use READ ENTITIES to verify the respective fields are updated as expected which would confirm that the required determinations were triggered as expected.

# Conclusion

Before spending a lot of time on writing a lot A Units, you should first decide the goal of such tests -

- is it just for the KPIs? (I have seen those too, believe me)

- is it to test each module individually?

- or are they more like end to end tests that test the business object behaviour in a broad sense?

In the nest posts, I will give more examples for each of these methods.

Cheers!
