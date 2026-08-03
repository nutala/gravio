export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Dernière mise à jour : août 2026
      </p>

      <section className="mt-8 space-y-4 text-sm">
        <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
        <p>
          Gravio est édité et exploité à titre personnel. Pour toute question
          relative à vos données, vous pouvez nous contacter à
          schmidtjordan94@gmail.com.
        </p>

        <h2 className="text-lg font-semibold">2. Données collectées</h2>
        <p>
          Lors de la création d'un compte (via Google ou par e-mail/mot de
          passe), nous collectons : votre adresse e-mail, votre nom d'affichage
          et, si vous le choisissez, une photo de profil. Lorsque vous utilisez
          l'application, vous enregistrez des données d'entraînement (exercices,
          séries, répétitions, temps de maintien, poids, ressenti, notes).
        </p>

        <h2 className="text-lg font-semibold">3. Utilisation des données</h2>
        <p>
          Vos données sont utilisées uniquement pour vous fournir le service de
          suivi d'entraînement (enregistrement, historique, statistiques et
          synchronisation entre vos appareils). Nous ne vendons pas vos données
          et ne les utilisons pas à des fins publicitaires.
        </p>

        <h2 className="text-lg font-semibold">
          4. Prestataires tiers (traitement)
        </h2>
        <p>
          Pour fournir le service, certaines de vos données sont traitées par des
          prestataires techniques :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Google</strong> — connexion via un compte Google (identité,
            adresse e-mail et nom). Si vous vous connectez avec Google, Google
            applique également sa propre politique de confidentialité.
          </li>
          <li>
            <strong>Supabase</strong> — hébergement et stockage de votre base de
            données (vos données d'entraînement et de compte).
          </li>
          <li>
            <strong>Render</strong> — hébergement de l'application (les serveurs
            qui font tourner Gravio).
          </li>
        </ul>

        <h2 className="text-lg font-semibold">5. Stockage et sécurité</h2>
        <p>
          Vos données sont stockées de manière sécurisée sur des serveurs
          hébergés en Europe et au Canada (selon l'infrastructure de nos
          prestataires). Nous mettons en œuvre des mesures raisonnables pour
          protéger vos données. Votre mot de passe est stocké de manière
          hachée ; personne ne peut lire votre mot de passe en clair.
        </p>

        <h2 className="text-lg font-semibold">6. Durée de conservation</h2>
        <p>
          Vos données sont conservées aussi longtemps que votre compte est
          actif. Vous pouvez supprimer votre compte et toutes vos données
          directement depuis l'application (menu Profil → « Supprimer
          mon compte »). Cette suppression est définitive et irréversible.
        </p>

        <h2 className="text-lg font-semibold">7. Vos droits</h2>
        <p>
          Conformément à la réglementation applicable (notamment le RGPD), vous
          disposez d'un droit d'accès, de rectification et de suppression de vos
          données. Vous pouvez exercer ces droits en nous écrivant à
          schmidtjordan94@gmail.com ou en supprimant votre compte directement
          dans l'application.
        </p>

        <h2 className="text-lg font-semibold">8. Cookies et traceurs</h2>
        <p>
          Gravio n'utilise pas de cookies publicitaires ni d'outils de suivi
          marketing. Une session de connexion temporaire est conservée pour vous
          maintenir authentifié(e).
        </p>

        <h2 className="text-lg font-semibold">9. Modification de la présente politique</h2>
        <p>
          Nous pouvons mettre à jour cette politique de temps à autre. La
          version en vigueur est toujours disponible sur cette page, avec sa
          date de mise à jour.
        </p>
      </section>
    </div>
  );
}