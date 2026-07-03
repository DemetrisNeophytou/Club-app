import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { palette, type AppLang } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { registerForPush } from "../../lib/push";
import { supabase } from "../../lib/supabase";

// Προφίλ (spec §5.6): language toggle + email OTP auth (passwordless).
export default function ProfileScreen() {
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isStaff, setIsStaff] = useState(false);
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
  }, [session]);

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
      <View className="flex-1 px-5 pt-2">
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
            <Pressable
              onPress={() => supabase.auth.signOut()}
              className="mt-4 self-start rounded-full border border-line px-5 py-2.5"
            >
              <Text className="text-dim">{t.auth.signOut}</Text>
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
      </View>
    </SafeAreaView>
  );
}
