import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-5">
      <div className="max-w-[420px] text-center flex flex-col gap-4">
        <h1 className="m-0 text-[28px] font-bold text-[#142240]">Page not found</h1>
        <p className="m-0 text-[15px] leading-[1.7] text-[#4F5A6B]">The page you are looking for does not exist or has moved.</p>
        <Link href="/" className="mx-auto h-11 px-5 rounded-xl bg-[#C8102E] text-white text-[14px] font-semibold flex items-center">Back to home</Link>
      </div>
    </main>
  );
}
