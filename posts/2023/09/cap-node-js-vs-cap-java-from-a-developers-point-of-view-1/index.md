---
title: "CAP Node.js vs CAP Java: From a Developer's Point of View #1"
date: "2023-09-09"
series: CAP Node JS v/s CAP Java
categories:
  - "cap"
  - "sap"
tags:
  - "cap"
  - "java"
  - "nodejs"
  - "sap"
excerpt: A comparison of CAP Java v/s CAP Node Js from a developer's point of view
---

This Wednesday, [SAP Developer Challenge for September 2023](https://blogs.sap.com/2023/09/06/sap-developer-challenge-full-stack-sap-cap-sap-fiori-elements/#:~:text=After%20setting%20up%20the%20SAP,Stack%20Cloud%20Application%E2%80%9D%20dev%20space.&text=Access%20the%20dev%20space%20by,the%20state%20changes%20to%20running.&text=On%20the%20Template%20Wizard%20page,and%20click%20the%20Start%20button.) kicked off with its [first task](https://groups.community.sap.com/t5/application-development-discussions/sap-developer-challenge-full-stack-project-set-up-and-database-modeling/td-p/284674). This time, we will be building a full stack application using CAP and Fiori Elements. We are free to choose either CAP Node.js or CAP Java to develop our data models and ODATA service. Whereas for frontend, we will use Fiori Elements.

I thought this would be a good chance to try both CAP Node.js and CAP Java and compare them from a developer's point of view.

CAP is quite opinionated on certain aspects while it also lets you choose either Node.js or Java to develop ODATA services. Normally, you would choose one or the other based on various aspects such as functionalities offered by the language/eco systems themselves, developer productivity, developer familiarity etc.

However, if you are someone who is new to both Javascript or Java, or may be, you are a little familiar with either or both of them, then which one would you prefere to go with? How should you choose? In a real world, again, this would most likely depend on the project you are going to work for. And, in such cases, decision would not be, most likely, yours to make.

In any case, it would be better to have some idea of what you are getting into before jumping into the waters. So, let's begin!

## Generating an Initial Project

CAP [Jumpstart a Project guide here](https://cap.cloud.sap/docs/get-started/jumpstart#jumpstart-cap-projects) explains these steps qiute well but also leaves you in the middel of the water when it comes to dependency related errors whie using CAP Java. This is what you will most likey face while working with Java. At least, I did. It took me hours to get the correct versions of Maven. Spring Boot, JDK etc and stitch them together. Even after spending all that hours, I cannot say I am still comfortable with that.

Whereas with CAP Node.js, it was like a cool breeze on a summer morning. Just pleasant. You install Node.js and NPM. Install `cds-dk` dependencies like it is mentioned in the link above, and then just type below command and you are on your track -

`cds init <projet_name>`

With CAP Java, you can use the below simple-looking command to generate a project, but for some reason, it did not work for me in the beginning. (it does now, not sure what went wrong the first time):

`cds init bookshop --add java`

However, for some reason, if you end up on [this page of "Getting Started" with CAP Java](http://`https://cap.cloud.sap/docs/java/getting-started), then you wil see a different set of instructions than the one above.

You will be asked to run this scary-looking command (God knows what it means! Are they trying to hack my computer?),

`mvn archetype:generate -DarchetypeArtifactId="cds-services-archetype" -DarchetypeGroupId="com.sap.cds" -DarchetypeVersion="RELEASE" -DinteractiveMode=true`

I will try to understand what this does and may be, write about it in one of the future posts!

For all the code samples and images below, dark theme is used for CAP Java and light theme is used for CAP Node.js

![pear-1-1024x1024.png](/static/img/2023/09/pear-1-1024x1024.png)

Wondering why there is an avacado, by the way? Becasue I am lazy to change it!

## Initial Project Structure

Anyway, generated project structure is different in both cases, though, on the surface, they look similar.

## 'app' Directory

CAP Node.js project has an `app` directory which is missing in case of CAP Java project

![image.png](/static/img/2023/09/image.png)

## Add Data Model and Service Exposure

There is not much difference between these two when it comes to defining your CDS data models (entities, types, aspects etc.). Let's say, as part of [Task 1 of the developer challenge](https://groups.community.sap.com/t5/application-development-discussions/sap-developer-challenge-full-stack-project-set-up-and-database-modeling/td-p/284674), we add below data models to our project, it looks exactly the same in either case.

```abap
using { cuid, managed } from '@sap/cds/common';

namespace fullstack_dev_challenge;

entity Tests: cuid, managed {
    title : String(30);
    description: String(111);
    questions: Composition of many Questions on questions.test = $self;
}

entity Questions: cuid{
    text: String(111);
    test: Association to one Tests;
    answers: Composition of one Answers;
}

aspect Answers: cuid {
    text: String;
}
```

As of now, exposing them as service also looks quite same. within 'srv' directory, you create a file named `cat-service.cds` and then expose the entities as below:

```abap
using fullstack_dev_challenge from '../db/data-model';

service DevChallengeService @(path: '/dev-challenge') {
    @odata.draft.enabled: true
    entity Tests as projection on fullstack_dev_challenge.Tests;
    entity Questions as projection on fullstack_dev_challenge.Questions;
}
```

I say "as of now" because, once we start adding custom logic to our service, I think this part looks very different in CAP Node.js and CAP Java.

## Run the application locally

In case of CAP Node.js, it is simple. From the root directory of your project, you run the below command

```
cds watch
```

In case of CAP Java, you can either do this:

```
cd srv && mvn cds:watch
```

Notice how you moved into `srv` directory to run the command.

Or, you can be on your root directory and run

```
mvn spring-boot:run
```

Difference is, `mvn spring-boot:run` does not watch for changes in your CDS models and regenerate the project automatically unlike `mvn cds:watch` which does it. This would be handy during development.

It took a lot of time for me to realize this because, for CAP Java, I initially landed on this [Getting Started page](https://cap.cloud.sap/docs/java/getting-started) which, for some strange reasons, does not mention this. Whereas, [Jumpstart your Project page](https://cap.cloud.sap/docs/get-started/jumpstart#jumpstart-cap-projects) does mention this!

## 'srv' Directory

Even before doing all the above steps, if you peek into `srv` directory, you will notice that in case of CAP Node.js, this directory is empty whereas that of CAP Java contains some generated files already.

Once you add more entities and expose them via services, you will see that CAP Java generates more and more Interfaces and Classes in this directory. Especially, for each Service, there will be a package created hence a subdirectory which will contain the Interfaces for entities exposed via that service. Of course, you will have to run the build/run command for this to happen in case of CAP Java:

After adding above entities and service, this is how the srv directory looks like

![image-1.png](/static/img/2023/09/image-1.png)

I could not help but feel that CAP Node.js is like that guy who does everything but never talks about it where as CAP Java creates a lof of noise doing so little.

Look at the sheer number of files created already! Not to mention the `.class` files created under `srv/target/` directory! May be I am missing something in case of CAP Node.js or nothign of that sort is generated at all.

That's it for this post. In the next one, let's see what happens when build our project after adding some entities/aspects etc.
