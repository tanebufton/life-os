import assert from "node:assert/strict";
const A = await import("../src/lib/attachments.ts"); const T = await import("../src/lib/tasks.ts"); const { db } = await import("../src/lib/db.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("rest")]), pdf = Buffer.from("%PDF-1.7\n..."), jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]), zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]);
for (const [name, b, mime] of [["shot.png", png, "image/png"], ["Photo.JPG", jpg, "image/jpeg"], ["a.pdf", pdf, "application/pdf"], ["notes.txt", Buffer.from("hello"), "text/plain; charset=utf-8"], ["data.csv", Buffer.from("a,b\n1,2"), "text/plain; charset=utf-8"], ["brief.docx", zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]] as const) {
  const v = A.classify(name, b); assert.equal(v.ok, true, name); assert.equal((v as any).mime, mime);
}
ok("images, PDFs, text, CSV and Office documents are accepted, with a type we choose");
for (const [name, b] of [["run.exe", Buffer.from("MZ....")], ["x.sh", Buffer.from("#!/bin/sh")], ["x.js", Buffer.from("alert(1)")], ["page.html", Buffer.from("<script>alert(1)</script>")], ["pic.svg", Buffer.from("<svg onload=alert(1)/>")], ["x.php", Buffer.from("<?php")], ["tool.jar", zip], ["setup.msi", zip], ["a.xml", Buffer.from("<a/>")]] as const) assert.equal(A.classify(name, b).ok, false, name);
ok("programs, scripts, web pages and SVG are refused");
for (const name of ["report.pdf.exe", "photo.png.html", "invoice.pdf.js", "doc.exe.txt", "a.PDF.Sh"]) assert.equal(A.classify(name, pdf).ok, false, name); ok("double extensions can't smuggle a program through");
assert.equal(A.classify("fake.png", Buffer.from("MZ this is a program")).ok, false); assert.equal(A.classify("fake.pdf", Buffer.from("<html>")).ok, false); assert.equal(A.classify("fake.docx", Buffer.from("not a zip")).ok, false); assert.equal(A.classify("bin.txt", Buffer.from([1, 2, 0, 3])).ok, false); ok("the contents have to match the name (an .exe renamed .png is refused)");
assert.equal(A.classify("noext", png).ok, false); assert.equal(A.classify("a.png", Buffer.alloc(0)).ok, false); assert.equal(A.classify("big.png", Buffer.concat([png, Buffer.alloc(A.MAX_BYTES)])).ok, false); ok("no extension, empty and oversized files are refused");
assert.equal(A.cleanName("..\\..\\etc/passwd.txt"), "passwd.txt"); assert.equal(A.cleanName('a"b<c>.png'), "abc.png"); ok("file names are stripped of paths and odd characters");
const t = T.createTask({ title: "With files" }); const r = A.addAttachment(t, "shot.png", png); assert.equal(r.ok, true);
assert.equal(A.listAttachments(t).length, 1); assert.equal(A.getAttachment((r as any).id)!.data.equals(png), true); ok("a file is stored in the database and comes back byte for byte");
assert.equal(A.addAttachment(t, "evil.exe", pdf).ok, false); assert.equal(A.addAttachment(99999, "a.png", png).ok, false); ok("refused files and unknown tasks store nothing");
for (let i = 0; i < A.MAX_PER_TASK; i++) A.addAttachment(t, `f${i}.png`, png); assert.equal(A.addAttachment(t, "one-more.png", png).ok, false); ok("a task can only hold so many files");
db.prepare("DELETE FROM tasks WHERE id=?").run(t); assert.equal((db.prepare("SELECT count(*) c FROM attachments WHERE task_id=?").get(t) as any).c, 0); ok("deleting a task removes its files");
console.log(`  ${n} checks`);
