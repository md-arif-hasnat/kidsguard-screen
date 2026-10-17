"use client";

import React, { useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { translateUiText } from "@/lib/i18n/uiTranslations";

const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;
type TranslationRecord = { source: string; rendered: string };

const ORIGINAL_TEXT = new WeakMap<Text, TranslationRecord>();
const ORIGINAL_ATTRIBUTES = new WeakMap<Element, Map<string, TranslationRecord>>();

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest("[data-no-auto-translate], code, pre, script, style"));
}
export default function LocalizedDashboardContent({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { locale } = useLanguage();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let applyingTranslation = false;

    const localizeTextNode = (node: Text) => {
      if (shouldSkip(node.parentElement)) return;

      const current = node.nodeValue ?? "";
      const previous = ORIGINAL_TEXT.get(node);
      const source = previous && current === previous.rendered ? previous.source : current;
      const next = translateUiText(source, locale);
      ORIGINAL_TEXT.set(node, { source, rendered: next });
      if (next !== current) node.nodeValue = next;
    };

    const localizeElement = (element: Element) => {
      if (shouldSkip(element)) return;

      const originals = ORIGINAL_ATTRIBUTES.get(element) ?? new Map<string, TranslationRecord>();
      for (const attribute of TRANSLATED_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const previous = originals.get(attribute);
        const source = previous && current === previous.rendered ? previous.source : current;
        const next = translateUiText(source, locale);
        originals.set(attribute, { source, rendered: next });
        if (next !== current) element.setAttribute(attribute, next);
      }
      ORIGINAL_ATTRIBUTES.set(element, originals);
    };

    const localizeTree = (node: Node) => {
      applyingTranslation = true;
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          localizeTextNode(node as Text);
          return;
        }
        if (!(node instanceof Element)) return;
        localizeElement(node);
        const walker = document.createTreeWalker(
          node,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        );
        let current: Node | null = walker.nextNode();
        while (current) {
          if (current.nodeType === Node.TEXT_NODE) localizeTextNode(current as Text);
          else localizeElement(current as Element);
          current = walker.nextNode();
        }
      } finally {
        applyingTranslation = false;
      }
    };

    localizeTree(root);

    const observer = new MutationObserver(mutations => {
      if (applyingTranslation) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          localizeTree(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(localizeTree);
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          localizeTree(mutation.target);
        }
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [locale]);

  return (
    <div ref={rootRef} className="contents" lang={locale}>
      {children}
    </div>
  );
}
