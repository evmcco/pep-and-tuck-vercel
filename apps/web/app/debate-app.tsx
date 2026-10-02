"use client";

import { MarkdownClient } from "@comark/react";
import { Client, type MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { useCallback, useRef, useState } from "react";

import {
  parseStance,
  SPEAKER_NAMES,
  stripStanceStreaming,
  type Speaker,
  type Stance,
} from "../../../agent/lib/debate";

const speakers: Record<Speaker, { name: string; subtitle: string }> = {
  pep: { name: SPEAKER_NAMES.pep, subtitle: "fiery little sister · GPT" },
  tuck: { name: SPEAKER_NAMES.tuck, subtitle: "steadfast big brother · Claude" },
};

function isSpeaker(value: string): value is Speaker {
  return value === "pep" || value === "tuck";
}

const STANCE_LABELS: Record<Stance, string> = {
  agree: "Agrees",
  partial: "Partly agrees",
  disagree: "Disagrees",
};

type TurnItem = {
  id: number;
  kind: "turn";
  speaker: Speaker;
  text: string;
  stance?: Stance;
  streaming: boolean;
  jumpsIn: boolean;
  activity?: string;
};

type ChatItem =
  | { id: number; kind: "user"; text: string }
  | TurnItem
  | { id: number; kind: "bottom"; text: string };

type NewChatItem =
  | { kind: "user"; text: string }
  | Omit<TurnItem, "id">
  | { kind: "bottom"; text: string };

type ChildStreamState = {
  speaker: Speaker;
  openItemId?: number;
};

export function DebateApp() {
  const [client] = useState(() => new Client({ host: "" }));
  const [items, setItems] = useState<ChatItem[]>([]);
  const nextIdRef = useRef(0);
  const runIdRef = useRef(0);
  const childrenRef = useRef(new Map<string, ChildStreamState>());
  const firstSpeakerRef = useRef<Speaker | undefined>(undefined);
  const greetedRef = useRef(new Set<Speaker>());

  const updateItem = useCallback((id: number, patch: Partial<TurnItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id && item.kind === "turn" ? { ...item, ...patch } : item)),
    );
  }, []);

  const appendItem = useCallback((item: NewChatItem) => {
    const id = nextIdRef.current++;
    setItems((current) => [...current, { ...item, id } as ChatItem]);
    return id;
  }, []);

  const streamChild = useCallback(
    async (speaker: Speaker, sessionId: string, runId: number) => {
      const state: ChildStreamState = { speaker };
      childrenRef.current.set(sessionId, state);
      const session = client.sessions.attach(sessionId, { streamIndex: 0 });

      const ensureBubble = (): number => {
        if (state.openItemId !== undefined) return state.openItemId;
        const isFirstTurnForSpeaker = !greetedRef.current.has(speaker);
        greetedRef.current.add(speaker);
        const jumpsIn = isFirstTurnForSpeaker && firstSpeakerRef.current !== speaker;
        state.openItemId = appendItem({
          kind: "turn",
          speaker,
          text: "",
          streaming: true,
          jumpsIn,
        });
        return state.openItemId;
      };

      try {
        for await (const event of session.stream()) {
          if (runIdRef.current !== runId) return;

          if (event.type === "message.appended") {
            const id = ensureBubble();
            setItems((current) =>
              current.map((item) =>
                item.id === id && item.kind === "turn"
                  ? { ...item, text: item.text + event.data.messageDelta }
                  : item,
              ),
            );
          }

          if (event.type === "message.completed" && event.data.message) {
            const id = ensureBubble();
            updateItem(id, { text: event.data.message });
          }

          if (event.type === "actions.requested") {
            const searching = event.data.actions.some(
              (action) =>
                "toolName" in action && action.toolName === "web_search",
            );
            const fetching = event.data.actions.some(
              (action) => "toolName" in action && action.toolName === "web_fetch",
            );
            const activity = searching
              ? "searching the web…"
              : fetching
                ? "fetching a page…"
                : undefined;
            if (activity && state.openItemId !== undefined) {
              updateItem(state.openItemId, { activity });
            }
          }

          if (event.type === "action.result" && state.openItemId !== undefined) {
            updateItem(state.openItemId, { activity: undefined });
          }

          if (event.type === "turn.completed" || event.type === "turn.failed") {
            if (state.openItemId !== undefined) {
              const id = state.openItemId;
              setItems((current) =>
                current.map((item) =>
                  item.id === id && item.kind === "turn"
                    ? {
                        ...item,
                        text: stripStanceStreaming(item.text),
                        stance: parseStance(item.text),
                        streaming: false,
                        activity: undefined,
                      }
                    : item,
                ),
              );
              state.openItemId = undefined;
            }
          }

          if (event.type === "session.completed" || event.type === "session.failed") return;
        }
      } catch {
        if (runIdRef.current !== runId) return;
        if (state.openItemId !== undefined) {
          updateItem(state.openItemId, { streaming: false, activity: undefined });
          state.openItemId = undefined;
        }
      }
    },
    [appendItem, client, updateItem],
  );

  const handleEvent = useCallback(
    (event: MessageStreamEvent) => {
      if (event.type === "subagent.called" && isSpeaker(event.data.name)) {
        const speaker = event.data.name;
        firstSpeakerRef.current ??= speaker;
        void streamChild(speaker, event.data.childSessionId, runIdRef.current);
      }

      if (
        event.type === "message.completed" &&
        event.data.message &&
        event.data.finishReason !== "tool-calls"
      ) {
        appendItem({ kind: "bottom", text: event.data.message });
      }
    },
    [appendItem, streamChild],
  );

  const agent = useEveAgent({ onEvent: handleEvent });
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const activeSpeaker = [...items].reverse().find(
    (item): item is TurnItem => item.kind === "turn" && item.streaming,
  )?.speaker;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const textarea = textareaRef.current;
    if (!textarea || busy) return;
    if (!textarea.reportValidity()) return;

    const message = textarea.value.trim();
    if (message.length === 0) return;

    appendItem({ kind: "user", text: message });
    textarea.value = "";
    void agent.send(message);
  };

  const newChat = () => {
    runIdRef.current += 1;
    childrenRef.current.clear();
    firstSpeakerRef.current = undefined;
    greetedRef.current.clear();
    setItems([]);
    agent.reset();
  };

  return (
    <div className="debate-shell">
      <header className="debate-header">
        <h1>Pep & Tuck</h1>
        <p>Ask anything. One pup answers, the other jumps in.</p>
        <button className="debate-new-chat" onClick={newChat} type="button">
          New chat
        </button>
      </header>

      <main aria-live="polite" className="debate-transcript">
        {items.length === 0 ? (
          <p className="debate-empty">
            No messages yet — ask a question and let Pep and Tuck hash it out.
          </p>
        ) : null}

        {items.map((item) => {
          if (item.kind === "user") {
            return (
              <div className="bubble bubble-user" key={item.id}>
                <MarkdownClient className="bubble-text" value={item.text} />
              </div>
            );
          }

          if (item.kind === "bottom") {
            return (
              <div className="bubble bubble-bottom" key={item.id}>
                <span className="bubble-kicker">Bottom line</span>
                <MarkdownClient className="bubble-text" value={item.text} />
              </div>
            );
          }

          return (
            <div className={`bubble bubble-${item.speaker}`} key={item.id}>
              <div className="bubble-heading">
                <span aria-hidden="true" className={`avatar avatar-${item.speaker}`}>
                  🐕
                </span>
                <span>
                  <span className="bubble-name">{speakers[item.speaker].name}</span>
                  <span className="bubble-subtitle">{speakers[item.speaker].subtitle}</span>
                </span>
                {item.jumpsIn ? <span className="chip chip-jumps">jumps in</span> : null}
                {item.stance ? (
                  <span className={`chip chip-${item.stance}`}>{STANCE_LABELS[item.stance]}</span>
                ) : null}
              </div>
              {item.activity ? <p className="bubble-activity">{item.activity}</p> : null}
              {item.text ? (
                <MarkdownClient
                  className="bubble-text"
                  streaming={item.streaming}
                  value={stripStanceStreaming(item.text)}
                />
              ) : item.streaming ? (
                <p className="bubble-typing">typing…</p>
              ) : null}
            </div>
          );
        })}

        {busy && activeSpeaker === undefined ? (
          <p className="bubble-typing debate-pending">thinking…</p>
        ) : null}

        {agent.error ? (
          <p className="debate-error" role="alert">
            {agent.error.message}
          </p>
        ) : null}
      </main>

      <form
        className="debate-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="debate-prompt">
          Ask a question
        </label>
        <textarea
          autoComplete="off"
          disabled={busy}
          id="debate-prompt"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything…"
          ref={textareaRef}
          required
          rows={3}
        />
        <div className="composer-footer">
          <span>Enter to send · Shift + Enter for a new line</span>
          <button disabled={busy} type="submit">
            {busy ? "Debating…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
