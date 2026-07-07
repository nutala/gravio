export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
      <p className="mt-4 text-sm text-muted-foreground">Dernière mise à jour : juillet 2026</p>

      <section className="mt-8 space-y-4 text-sm">
        <h2 className="text-lg font-semibold">1. Collecte des données</h2>
        <p>
          Gravio collecte les informations suivantes lors de la création d'un compte :
          votre adresse e-mail, votre nom d'affichage, et les données d'entraînement
          que vous saisissez (exercices, séries, répétitions, poids).
        </p>

        <h2 className="text-lg font-semibold">2. Utilisation des données</h2>
        <p>
          Vos données sont utilisées uniquement pour vous fournir le service de suivi
          d'entraînement. Nous ne vendons ni ne partageons vos données avec des tiers.
        </p>

        <h2 className="text-lg font-semibold">3. Stockage</h2>
        <p>
          Les données sont stockées de manière sécurisée sur nos serveurs. Vous pouvez
          demander la suppression de votre compte et de toutes vos données à tout moment.
        </p>

        <h2 className="text-lg font-semibold">4. Contact</h2>
        <p>
          Pour toute question concernant cette politique, contactez-nous à
          schmidtjordan94@gmail.com.
        </p>
      </section>
    </div>
  );
}
