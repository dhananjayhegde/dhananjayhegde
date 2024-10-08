const { DateTime } = require("luxon");
const CleanCSS = require("clean-css");
const UglifyJS = require("uglify-js");
const htmlmin = require("html-minifier");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

const markdownIt = require("markdown-it");

const getExcerpt = (post) => {
  const md = new markdownIt({ html: true });
  if (post.data.excerpt) {
    return md.render(post.data.excerpt);
  } else if (post.data.page.excerpt) {
    return md.render(post.data.page.excerpt);
  }
  return null;
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addShortcode("currentyear", function () {
    return new Date().getFullYear();
  });

  eleventyConfig.addShortcode("excerpt", (post) => getExcerpt(post));

  // Eleventy Navigation https://www.11ty.dev/docs/plugins/navigation/
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Configuration API: use eleventyConfig.addLayoutAlias(from, to) to add
  // layout aliases! Say you have a bunch of existing content using
  // layout: post. If you don’t want to rewrite all of those values, just map
  // post to a new file like this:
  // eleventyConfig.addLayoutAlias("post", "layouts/my_new_post_layout.njk");

  // Merge data instead of overriding
  // https://www.11ty.dev/docs/data-deep-merge/
  eleventyConfig.setDataDeepMerge(true);
  eleventyConfig.setFrontMatterParsingOptions({
    excerpt: true,
    excerpt_alias: "excerpt",
  });

  // Add support for maintenance-free post authors
  // Adds an authors collection using the author key in our post frontmatter
  // Thanks to @pdehaan: https://github.com/pdehaan
  eleventyConfig.addCollection("authors", (collection) => {
    const blogs = collection.getFilteredByTags("post");
    return blogs.reduce((coll, post) => {
      const author = post.data.author;
      if (!author) {
        return coll;
      }
      if (!coll.hasOwnProperty(author)) {
        coll[author] = [];
      }
      coll[author].push(post.data);
      return coll;
    }, {});
  });

  eleventyConfig.addCollection("series", (collection) => {
    const blogs = collection.getFilteredByTags("post");
    const seriesColl = blogs.reduce((coll, post) => {
      const series = post.data.series;
      if (!series) {
        return coll;
      }
      if (!coll.hasOwnProperty(series)) {
        coll[series] = [];
      }
      coll[series].push(post.data);
      return coll;
    }, {});

    return seriesColl;
  });

  // Tag list and count of posts
  eleventyConfig.addCollection("tagList", (collection) => {
    const tagsObject = {};
    collection.getFilteredByTags("post").forEach((item) => {
      if (!item.data.tags) return;
      item.data.tags
        .filter((tag) => !["post", "all"].includes(tag))
        .forEach((tag) => {
          if (typeof tagsObject[tag] === "undefined") {
            tagsObject[tag] = 1;
          } else {
            tagsObject[tag] += 1;
          }
        });
    });

    const tagList = [];
    Object.keys(tagsObject).forEach((tag) => {
      tagList.push({ tagName: tag, tagCount: tagsObject[tag] });
    });

    return tagList.sort((a, b) => b.tagCount - a.tagCount);
  });

  // Category list and count of posts
  eleventyConfig.addCollection("categoryList", (collection) => {
    const tagsObject = {};
    collection.getFilteredByTags("post").forEach((item) => {
      if (!item.data.categories) return;
      item.data.categories.forEach((cat) => {
        if (typeof tagsObject[cat] === "undefined") {
          tagsObject[cat] = {
            count: 1,
            posts: [],
          };
        } else {
          tagsObject[cat].count += 1;
        }
        tagsObject[cat].posts.push(item);
      });
    });

    const tagList = [];
    Object.keys(tagsObject).forEach((tag) => {
      tagList.push({
        name: tag,
        postCount: tagsObject[tag].count,
        posts: tagsObject[tag].posts,
      });
    });

    return tagList.sort((a, b) => b.postCount - a.postCount);
  });

  // Posts by Year
  eleventyConfig.addCollection("postYearList", (collection) => {
    const tagsObject = {};
    collection.getFilteredByTags("post").forEach((item) => {
      if (!item.data.date) return;
      const year = new Date(item.data.date).getFullYear();

      if (typeof tagsObject[year] === "undefined") {
        tagsObject[year] = {
          count: 1,
          posts: [],
        };
      } else {
        tagsObject[year].count += 1;
      }
      tagsObject[year].posts.push(item);
    });

    const tagList = [];
    Object.keys(tagsObject).forEach((year) => {
      tagList.push({
        year: year,
        postCount: tagsObject[year].count,
        posts: tagsObject[year].posts,
      });
    });

    return tagList.sort((a, b) => b.year - a.year);
  });

  // Date formatting (human readable)
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toFormat("LLLL dd, yyyy");
  });

  // Date formatting (machine readable)
  eleventyConfig.addFilter("machineDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj).toFormat("yyyy-MM-dd");
  });

  // Minify CSS
  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // Minify JS
  eleventyConfig.addFilter("jsmin", function (code) {
    let minified = UglifyJS.minify(code);
    if (minified.error) {
      console.log("UglifyJS error: ", minified.error);
      return code;
    }
    return minified.code;
  });

  // Minify HTML output
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath.indexOf(".html") > -1) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
      return minified;
    }
    return content;
  });

  eleventyConfig.addPlugin(syntaxHighlight);

  // eleventyConfig.addPassthroughCopy("*/images/*.jpg");
  // eleventyConfig.addPassthroughCopy("*/images/*.png");

  // Don't process folders with static assets e.g. images
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("static/img");
  eleventyConfig.addPassthroughCopy("admin/");
  // We additionally output a copy of our CSS for use in Decap CMS previews
  eleventyConfig.addPassthroughCopy("_includes/assets/css/inline.css");

  eleventyConfig.addPassthroughCopy(
    "_includes/assets/fontawesome/webfonts/fa-brands-400.woff2"
  );
  eleventyConfig.addPassthroughCopy(
    "_includes/assets/fontawesome/webfonts/fa-regular-400.woff2"
  );
  eleventyConfig.addPassthroughCopy(
    "_includes/assets/fontawesome/webfonts/fa-solid-900.woff2"
  );
  eleventyConfig.addPassthroughCopy(
    "_includes/assets/fontawesome/webfonts/fa-v4compatibility.woff2"
  );

  eleventyConfig.addPassthroughCopy(
    "_includes/assets/fontawesome/css/all.min.css"
  );

  /* Markdown Plugins */
  let markdownIt = require("markdown-it");
  let markdownItAnchor = require("markdown-it-anchor");
  let options = {
    breaks: true,
    linkify: true,
  };
  let opts = {
    permalink: false,
  };

  eleventyConfig.setLibrary(
    "md",
    markdownIt(options).use(markdownItAnchor, opts)
  );

  return {
    templateFormats: ["md", "njk", "liquid"],

    // If your site lives in a different subdirectory, change this.
    // Leading or trailing slashes are all normalized away, so don’t worry about it.
    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for URLs (it does not affect your file structure)
    pathPrefix: "/",

    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
};
