import { memo, useMemo, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View, type TextStyle } from 'react-native';
import { marked, type Token, type Tokens } from 'marked';
import { fonts, useTheme, type Theme } from '@/lib/theme';

/** Markdown → native views, using marked's lexer (pure JS, no WebView). */
export const Markdown = memo(function Markdown({ text, size = 16, color }: { text: string; size?: number; color?: string }) {
  const t = useTheme();
  const tokens = useMemo(() => marked.lexer(text, { gfm: true }), [text]);
  return <View>{blocks(tokens, { t, size, color: color ?? t.text })}</View>;
});

interface Ctx {
  t: Theme;
  size: number;
  color: string;
}

function blocks(tokens: Token[], c: Ctx): ReactNode[] {
  const out: ReactNode[] = [];
  const n = tokens.filter((x) => x.type !== 'space').length;
  let i = 0;
  for (const tok of tokens) {
    if (tok.type === 'space') continue;
    const last = ++i === n;
    out.push(<View key={i} style={{ marginBottom: last ? 0 : c.size * 0.65 }}>{block(tok, c)}</View>);
  }
  return out;
}

function block(tok: Token, c: Ctx): ReactNode {
  const { t, size } = c;
  const base: TextStyle = { color: c.color, fontSize: size, lineHeight: size * 1.55 };
  switch (tok.type) {
    case 'paragraph':
      return <Text style={base} selectable>{inline((tok as Tokens.Paragraph).tokens, c)}</Text>;
    case 'heading': {
      const h = tok as Tokens.Heading;
      const fs = size * ([1.35, 1.22, 1.1, 1, 1, 1][h.depth - 1] ?? 1);
      return <Text style={{ ...base, fontFamily: fonts.serif, fontWeight: '700', fontSize: fs, lineHeight: fs * 1.3, marginTop: 4 }}>{inline(h.tokens, c)}</Text>;
    }
    case 'code':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: t.codeBg, borderRadius: 12, borderWidth: 1, borderColor: t.border }}>
          <Text selectable style={{ fontFamily: fonts.mono, fontSize: 13, lineHeight: 19, color: t.text, padding: 12 }}>{(tok as Tokens.Code).text}</Text>
        </ScrollView>
      );
    case 'list': {
      const l = tok as Tokens.List;
      return (
        <View style={{ gap: 4 }}>
          {l.items.map((it, j) => (
            <View key={j} style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
              <Text style={{ ...base, color: t.text3, minWidth: l.ordered ? 20 : 10, textAlign: 'right' }}>
                {it.task ? (it.checked ? '☑' : '☐') : l.ordered ? `${Number(l.start || 1) + j}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>{listItem(it, c)}</View>
            </View>
          ))}
        </View>
      );
    }
    case 'blockquote':
      return (
        <View style={{ borderLeftWidth: 3, borderLeftColor: t.borderStrong, paddingLeft: 12 }}>
          {blocks((tok as Tokens.Blockquote).tokens, { ...c, color: t.text2 })}
        </View>
      );
    case 'hr':
      return <View style={{ height: 1, backgroundColor: t.borderStrong, marginVertical: 4 }} />;
    case 'table': {
      const tb = tok as Tokens.Table;
      const cell = (cellTokens: Token[], head: boolean, k: number) => (
        <View key={k} style={{ minWidth: 90, maxWidth: 240, padding: 8, borderWidth: 0.5, borderColor: t.borderStrong, backgroundColor: head ? t.surface : 'transparent' }}>
          <Text style={{ ...base, fontSize: size - 2, lineHeight: (size - 2) * 1.4, fontWeight: head ? '700' : '400' }}>{inline(cellTokens, c)}</Text>
        </View>
      );
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row' }}>{tb.header.map((h, k) => cell(h.tokens, true, k))}</View>
            {tb.rows.map((r, j) => (
              <View key={j} style={{ flexDirection: 'row' }}>{r.map((h, k) => cell(h.tokens, false, k))}</View>
            ))}
          </View>
        </ScrollView>
      );
    }
    case 'html':
    case 'text':
      return <Text style={base} selectable>{'tokens' in tok && tok.tokens ? inline(tok.tokens as Token[], c) : (tok as any).text}</Text>;
    default:
      return 'raw' in tok ? <Text style={base}>{(tok as any).raw}</Text> : null;
  }
}

function listItem(it: Tokens.ListItem, c: Ctx): ReactNode {
  const base: TextStyle = { color: c.color, fontSize: c.size, lineHeight: c.size * 1.55 };
  // "Tight" list items hold inline text tokens directly; loose ones hold paragraphs.
  const parts: ReactNode[] = [];
  it.tokens.forEach((tk, k) => {
    if (tk.type === 'text') parts.push(<Text key={k} style={base} selectable>{(tk as Tokens.Text).tokens ? inline((tk as Tokens.Text).tokens!, c) : (tk as Tokens.Text).text}</Text>);
    else if (tk.type !== 'space' && tk.type !== 'checkbox') parts.push(<View key={k} style={{ marginTop: 4 }}>{block(tk, c)}</View>);
  });
  return parts;
}

function inline(tokens: Token[] | undefined, c: Ctx): ReactNode[] {
  if (!tokens) return [];
  const { t } = c;
  return tokens.map((tok, k) => {
    switch (tok.type) {
      case 'strong':
        return <Text key={k} style={{ fontWeight: '700' }}>{inline((tok as Tokens.Strong).tokens, c)}</Text>;
      case 'em':
        return <Text key={k} style={{ fontStyle: 'italic' }}>{inline((tok as Tokens.Em).tokens, c)}</Text>;
      case 'del':
        return <Text key={k} style={{ textDecorationLine: 'line-through' }}>{inline((tok as Tokens.Del).tokens, c)}</Text>;
      case 'codespan':
        return (
          <Text key={k} style={{ fontFamily: fonts.mono, fontSize: c.size * 0.86, backgroundColor: t.surface, color: t.text }}>
            {` ${decode((tok as Tokens.Codespan).text)} `}
          </Text>
        );
      case 'link': {
        const l = tok as Tokens.Link;
        return (
          <Text key={k} style={{ color: t.accent, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(l.href)}>
            {inline(l.tokens, c)}
          </Text>
        );
      }
      case 'br':
        return '\n';
      case 'escape':
      case 'text': {
        const tt = tok as Tokens.Text;
        return tt.tokens ? <Text key={k}>{inline(tt.tokens, c)}</Text> : decode(tt.text);
      }
      default:
        return decode((tok as any).raw ?? '');
    }
  });
}

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m] ?? m);
}
