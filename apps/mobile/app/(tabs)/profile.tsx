import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { palette, type AppLang } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import { registerForPush } from "../../lib/push";
import { supabase } from "../../lib/supabase";

interface PastEvent {
  id: string;
  name: string;
  starts_at: string;
}

// Προφίλ (spec §5.6): language toggle + email OTP auth (passwordless).
export default function ProfileScreen() {
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [history, setHistory] = useState<PastEvent[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Door mode entry appears only for venue staff (any role).
  useEffect(() => {
    if (!session) {
      setIsStaff(false);
      return;
    }
    registerForPush();
    supabase
      .from("venue_members")
      .select("venue_id")
      .limit(1)
      .then(({ data }) => setIsStaff((data ?? []).length > 0));

    // Πού έχεις πάει — scanned tickets for events that already happened.
    supabase
      .from("tickets")
      .select("event:events(id, name, starts_at)")
      .in("status", ["scanned"])
      .then(({ data }) => {
        const events = (data ?? [])
          .map((r) => r.event as unknown as PastEvent)
          .filter((e) => e && Date.parse(e.starts_at) < Date.now());
        const unique = [...new Map(events.map((e) => [e.id, e])).values()];
        unique.sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
        setHistory(unique.slice(0, 20));
      });
  }, [session]);

  const deleteAccount = () => {
    Alert.alert(t.profile.deleteConfirmTitle, t.profile.deleteConfirmBody, [
      { text: t.venues.cancel, style: "cancel" },
      {
        text: t.profile.deleteAccount,
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.functions.invoke("delete-account", { body: {} });
          if (!error) await supabase.auth.signOut();
          else setMessage(t.common.error);
        },
      },
    ]);
  };

  const sendCode = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) setMessage(t.common.error);
    else {
      setCodeSent(true);
      setMessage(t.auth.codeSent);
    }
  };

  const verify = async () => {
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) setMessage(t.common.error);
  };

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <ScrollView className="flex-1 px-5 pt-2" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mb-6 font-display text-3xl font-black text-bone">{t.tabs.profile}</Text>

        {/* Language */}
        <Text className="mb-2 text-sm text-dim">{t.profile.language}</Text>
        <View className="mb-8 flex-row">
          {(["el", "en"] as AppLang[]).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              className={`mr-2 rounded-full border px-5 py-2 ${
                lang === l ? "border-copper bg-copper/15" : "border-line"
              }`}
            >
              <Text className={lang === l ? "text-copper-hi" : "text-dim"}>
                {l === "el" ? "Ελληνικά" : "English"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Auth */}
        {session ? (
          <View>
            <Text className="text-dim">{session.user.email}</Text>
            {isStaff && (
              <Pressable
                onPress={() => router.push("/door")}
                className="mt-4 items-center rounded-2xl bg-seaglass py-3.5"
              >
                <Text className="font-display font-bold text-abyss">{t.door.openDoorMode}</Text>
              </Pressable>
            )}

            {/* Πού έχεις πάει */}
            <Text className="mb-2 mt-8 text-sm text-dim">{t.profile.history}</Text>
            {history.length === 0 ? (
              <Text className="text-sm text-dim opacity-60">{t.profile.historyEmpty}</Text>
            ) : (
              history.map((e) => (
                <View key={e.id} className="mb-2 rounded-xl border border-line bg-card px-4 py-3">
                  <Text className="font-display font-bold text-bone">{e.name}</Text>
                  <Text className="mt-0.5 text-xs text-dim">{formatEventTime(e.starts_at, lang)}</Text>
                </View>
              ))
            )}

            <Pressable
              onPress={() => supabase.auth.signOut()}
              className="mt-8 self-start rounded-full border border-line px-5 py-2.5"
            >
              <Text className="text-dim">{t.auth.signOut}</Text>
            </Pressable>
            {/* GDPR (spec §9): the way out must be as real as the way in */}
            <Pressable onPress={deleteAccount} className="mt-4 self-start">
              <Text className="text-xs text-dim underline">{t.profile.deleteAccount}</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text className="mb-2 text-sm text-dim">{t.auth.signIn}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t.auth.emailPlaceholder}
              placeholderTextColor={palette.dim}
              autoCapitalize="none"
              keyboardType="email-address"
              className="mb-3 rounded-2xl border border-line bg-deep px-4 py-3 text-bone"
            />
            {codeSent && (
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={t.auth.codePlaceholder}
                placeholderTextColor={palette.dim}
                keyboardType="number-pad"
                className="mb-3 rounded-2xl border border-line bg-deep px-4 py-3 font-mono text-bone"
              />
            )}
            <Pressable
              onPress={codeSent ? verify : sendCode}
              className="items-center rounded-2xl bg-copper py-3.5 active:opacity-85"
            >
              <Text className="font-display font-bold text-abyss">
                {codeSent ? t.auth.verify : t.auth.sendCode}
              </Text>
            </Pressable>
            {message && <Text className="mt-3 text-sm text-seaglass">{message}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
