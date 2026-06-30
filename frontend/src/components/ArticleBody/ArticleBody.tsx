import type { ReactNode } from "react";
import type { Block, InlineNode } from "@/lib/strapi";

// Renders Strapi "blocks" rich-text for a buying guide. design.md §3/§5/§6:
// paragraphs 17px/1.72, green Oswald H2s, rust-dot lists, and a cream tip callout.

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "link") {
          const external = n.url.startsWith("http");
          return (
            <a
              key={i}
              href={n.url}
              className="text-rust underline underline-offset-2 hover:text-rust-dark"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <Inline nodes={n.children} />
            </a>
          );
        }
        let el: ReactNode = n.text;
        if (n.bold) el = <strong>{el}</strong>;
        if (n.italic) el = <em>{el}</em>;
        if (n.underline) el = <u>{el}</u>;
        if (n.strikethrough) el = <s>{el}</s>;
        if (n.code) el = <code>{el}</code>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

function TipCallout({ children }: { children: ReactNode }) {
  return (
    <div className="my-8 flex gap-3.5 rounded-xl border border-line border-l-4 border-l-rust bg-cream px-5 py-[18px]">
      <svg
        aria-hidden
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="mt-0.5 shrink-0 text-rust"
      >
        <path
          d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="m-0 text-[15.5px] font-medium leading-[1.6] text-ink">{children}</p>
    </div>
  );
}

export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="text-ink">
      {blocks.map((block, i) => {
        const children = (block.children ?? []) as InlineNode[];
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={i}
                className="font-oswald mt-[38px] mb-3.5 text-[25px] font-bold tracking-[-0.3px] text-green"
              >
                <Inline nodes={children} />
              </h2>
            );
          case "list": {
            const items = children as unknown as { children: InlineNode[] }[];
            return (
              <ul key={i} className="m-0 mb-6 flex list-none flex-col gap-3 p-0">
                {items.map((li, j) => (
                  <li key={j} className="flex gap-3 text-base leading-[1.6] text-ink">
                    <span aria-hidden className="mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full bg-rust" />
                    <span>
                      <Inline nodes={li.children} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          }
          case "quote":
            return (
              <TipCallout key={i}>
                <Inline nodes={children} />
              </TipCallout>
            );
          case "paragraph":
          default:
            return (
              <p key={i} className="mb-[22px] text-[17px] leading-[1.72] text-ink">
                <Inline nodes={children} />
              </p>
            );
        }
      })}
    </div>
  );
}
