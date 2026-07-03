import { Text, View } from "react-native";

type Tone = "copper" | "seaglass" | "dim";

const TONE_STYLES: Record<Tone, { box: string; text: string }> = {
  copper: { box: "bg-copper/15 border-copper/40", text: "text-copper-hi" },
  seaglass: { box: "bg-seaglass/10 border-seaglass/40", text: "text-seaglass" },
  dim: { box: "bg-line/40 border-line", text: "text-dim" },
};

export function Badge({ label, tone = "dim" }: { label: string; tone?: Tone }) {
  const s = TONE_STYLES[tone];
  return (
    <View className={`rounded-full border px-2.5 py-0.5 ${s.box}`}>
      <Text className={`font-mono text-[11px] ${s.text}`}>{label}</Text>
    </View>
  );
}
