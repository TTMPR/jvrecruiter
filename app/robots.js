export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/jobs/"],
        disallow: ["/admin/", "/api/"]
      }
    ],
    sitemap: "https://jvrecruiter.xyz/sitemap.xml",
    host: "https://jvrecruiter.xyz"
  };
}
