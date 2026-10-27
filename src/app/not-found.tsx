import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Not found</h1>
      <p>We could not find that page.</p>
      <p>
        <Link href="/products">Back to the products</Link>
      </p>
    </>
  );
}
