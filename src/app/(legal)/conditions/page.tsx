export default function ConditionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Conditions d'utilisation</h1>
      <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : juillet 2026</p>

      <section className="mt-8 space-y-4 text-sm">
        <h2 className="text-lg font-semibold">1. Acceptation des conditions</h2>
        <p>
          En utilisant Gravio, vous acceptez les présentes conditions d'utilisation.
          Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.
        </p>

        <h2 className="text-lg font-semibold">2. Description du service</h2>
        <p>
          Gravio est une application de suivi d'entraînement physique qui vous permet
          de planifier, enregistrer et suivre vos séances de sport.
        </p>

        <h2 className="text-lg font-semibold">3. Compte utilisateur</h2>
        <p>
          Vous êtes responsable de la confidentialité de votre compte et de votre mot de
          passe. Vous devez nous informer immédiatement de toute utilisation non autorisée
          de votre compte.
        </p>

        <h2 className="text-lg font-semibold">4. Responsabilité</h2>
        <p>
          Gravio est fourni &quot;tel quel&quot; sans garantie d'aucune sorte. Nous ne
          sommes pas responsables des dommages directs ou indirects résultant de
          l'utilisation de l'application.
        </p>
      </section>
    </div>
  );
}
