// AP Computer Science A 시험 참조 패널 — ALTON 자체 문구(공식 Java Quick Reference 본문을 복제하지 않는다).
// 공식 근거: AP Central 시험 페이지(https://apcentral.collegeboard.org/courses/ap-computer-science-a/exam)는 "Java Quick Reference 가 Bluebook 에 포함되며 시험에 나올 수 있는
// 접근 가능한 Java 라이브러리 메서드를 나열한다"고만 밝힌다. 항목 목록의 1:1 일치는 UNVERIFIED — 아래는 이 앱의 문항이 쓰는 표준 Java 메서드를 ALTON 이 자기 말로 정리한 것이다.
export const JAVA_REF_DISCLAIMER = "ALTON study reference — not the official College Board sheet. Use the official Java Quick Reference for exam preparation.";
export type JavaRefGroup = { id: string; title: string; items: { sig: string; note: string }[] };
export const JAVA_GROUPS: JavaRefGroup[] = [
  { id: "string", title: "String", items: [
    { sig: "int length()", note: "number of characters" },
    { sig: "String substring(int from, int to)", note: "characters from index from up to, but not including, index to" },
    { sig: "String substring(int from)", note: "characters from index from to the end" },
    { sig: "int indexOf(String str)", note: "index of the first occurrence of str, or -1 if there is none" },
    { sig: "boolean equals(String other)", note: "true when both Strings hold the same characters" },
    { sig: "int compareTo(String other)", note: "negative, zero or positive when this String comes before, equals or comes after other" },
    { sig: "char charAt(int index)", note: "the character at index (the first character has index 0)" },
  ] },
  { id: "math", title: "Math", items: [
    { sig: "static int abs(int x)  /  static double abs(double x)", note: "absolute value" },
    { sig: "static double pow(double base, double exponent)", note: "base raised to exponent, as a double" },
    { sig: "static double sqrt(double x)", note: "positive square root, as a double" },
    { sig: "static double random()", note: "a double from 0.0 up to, but not including, 1.0" },
  ] },
  { id: "integer", title: "Integer and Double", items: [
    { sig: "Integer.MIN_VALUE, Integer.MAX_VALUE", note: "smallest and largest int values" },
    { sig: "int intValue()  /  double doubleValue()", note: "unwrap an Integer or Double object" },
  ] },
  { id: "arraylist", title: "ArrayList<E>", items: [
    { sig: "int size()", note: "number of elements" },
    { sig: "boolean add(E obj)", note: "append obj at the end; returns true" },
    { sig: "void add(int index, E obj)", note: "insert obj at index; later elements shift right" },
    { sig: "E get(int index)", note: "the element at index" },
    { sig: "E set(int index, E obj)", note: "replace the element at index; returns the old element" },
    { sig: "E remove(int index)", note: "remove the element at index; later elements shift left; returns it" },
  ] },
  { id: "array", title: "Arrays", items: [
    { sig: "arr.length", note: "number of elements of an array (a field, not a method); a 2D array has grid.length rows and grid[r].length columns" },
  ] },
  { id: "note", title: "Notes", items: [
    { sig: "Indexes start at 0.", note: "valid array and String indexes run from 0 through length - 1" },
    { sig: "Integer division truncates.", note: "7 / 2 is 3; the remainder operator % gives 7 % 2 is 1" },
    { sig: "Object references.", note: "an assignment between object variables copies the reference, not the object" },
  ] },
];
