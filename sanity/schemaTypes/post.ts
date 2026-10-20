import { defineField, defineType } from "sanity";

/**
 * ALTON Insights 글. 초안/게시 상태는 Sanity 기본 draft 문서 모델(`drafts.` 접두 id)을 그대로 쓴다 —
 * 공개 사이트 GROQ는 게시본만 읽는다.
 */
export const post = defineType({
  name: "post",
  title: "Insights article",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      description: "Short summary shown on the /insights listing card.",
      validation: (rule) => rule.max(280),
    }),
    defineField({ name: "publishedAt", title: "Published date", type: "datetime", validation: (rule) => rule.required() }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alt text", type: "string" })],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading 2", value: "h2" },
            { title: "Heading 3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [
            { title: "Bulleted", value: "bullet" },
            { title: "Numbered", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "URL",
                    validation: (rule) => rule.uri({ allowRelative: true, scheme: ["http", "https", "mailto"] }),
                  },
                ],
              },
            ],
          },
        },
      ],
    }),
    defineField({
      name: "relatedSubjects",
      title: "Related subjects",
      type: "array",
      of: [{ type: "string" }],
      description: "Subject page slugs, e.g. ap-calculus-ab or sat. Shown as practice-test links under the article.",
    }),
  ],
  preview: { select: { title: "title", subtitle: "publishedAt", media: "coverImage" } },
});
