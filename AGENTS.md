<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules

- Staff permissions live only in `public.user_roles` (enum `app_role`) and are read through the
  security-definer `has_role` / `is_barbeiro` functions — never a role column on `profiles`,
  because client-editable profile data must never decide privileges.
- The full client list is privileged data: only RLS policies guarded by `has_role(auth.uid(),
  'barbeiro')` may read every `appointments` row and every `profiles` row, and the `/painel`
  route re-checks `is_barbeiro()` server-side, so a signed-in client can never enumerate others.
