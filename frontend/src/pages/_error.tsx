import type { NextPageContext } from "next";

interface ErrorPageProps {
  statusCode?: number;
}

function normalizeStatusCode(statusCode: unknown): number | undefined {
  return typeof statusCode === "number" ? statusCode : undefined;
}

function ErrorPage({ statusCode }: ErrorPageProps) {
  const safeStatusCode = normalizeStatusCode(statusCode);
  const title = safeStatusCode ?? "Error";
  const description =
    safeStatusCode === 404
      ? "This page could not be found."
      : "An unexpected error has occurred.";

  return (
    <div style={{ textAlign: "center", padding: "100px 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "48px", margin: 0 }}>{title}</h1>
      <p style={{ fontSize: "18px", color: "#636363", marginTop: "16px" }}>{description}</p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  const statusCode = res?.statusCode ?? err?.statusCode;
  return { statusCode: normalizeStatusCode(statusCode) ?? 404 };
};

export default ErrorPage;
