type CompleteRegistrationOptions = {
  next?: string | null;
  signOut: () => Promise<unknown>;
  notifySuccess: () => void;
  navigate: (href: string) => void;
};

export async function completeRegistration({
  next,
  signOut,
  notifySuccess,
  navigate,
}: CompleteRegistrationOptions) {
  await signOut();
  notifySuccess();
  navigate(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
