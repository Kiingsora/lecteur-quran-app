# 📜 Suivi du Projet Qira'ah - Assistant IA

## 🎯 Définition du Projet
**Qira'ah** est une plateforme moderne d'apprentissage et de révision du Coran. Elle permet aux apprenants d'enregistrer leur récitation verset par verset (Push-to-Talk) et aux professeurs de réviser ces enregistrements avec des outils de correction précis (annotations sur onde sonore, checklist Tajweed).

---

## 🛠️ État d'avancement

### 1. Interface Apprenant (Dashboard & Lecteur)
- [x] **Layout Split-Screen** : Panneau d'enregistrement à gauche, Coran à droite.
- [x] **Lecteur Coran Avancé** : Affichage par cartes (style Saint-Coran.net).
- [x] **Options de Lecture** : Couleurs Tajweed, Traduction française, Phonétique.
- [x] **Auto-Loading** : Chargement immédiat du texte lors du choix de la sourate.
- [x] **Interactivité des Versets** : Écoute individuelle, copie du texte, lien vers le Tafsir.
- [x] **Gestion de la Taille** : Ajustement dynamique de la police (A+ / A-).
- [x] **Nettoyage UI** : Suppression des barres latérales inutiles en mode lecture.

### 2. Système d'Enregistrement
- [x] **Push-to-Talk (PTT)** : Enregistrement via maintien de la barre `ESPACE`.
- [x] **Gestion par Blocs** : Chaque verset enregistré apparaît comme un bloc audio indépendant.
- [x] **Édition des Blocs** : Possibilité de réécouter et de supprimer un bloc avant envoi.
- [ ] **Séquençage Automatique** : Passage automatique au verset suivant après un enregistrement.
- [ ] **Fusion Audio** : Combiner tous les blocs en une seule piste pour le professeur.

### 3. Interface Relecteur (Professeur)
- [x] **Dashboard Professeur** : Statistiques (en attente, corrigées, apprenants).
- [x] **Waveform Interactif** : Visualisation de l'onde sonore de la récitation.
- [x] **Outils de Correction** : Système de "Pins" (repères) avec catégories (Madd, Ghunnah, etc.).
- [x] **Checklist Tajweed** : Validation rapide des points clés.
- [ ] **Commentaires Vocaux** : Possibilité pour le prof d'enregistrer un retour audio.

### 4. Infrastructure Technique
- [x] **Proxy API Coran** : Fusion de 3 éditions (Arabe Tajweed, FR, Translit) en une seule requête.
- [x] **Sécurité CSP** : Mise en place de Nonce et protection contre les injections.
- [x] **Stockage Local** : Gestion des sessions et états via JavaScript.
- [ ] **Base de Données** : Finalisation de la sauvegarde des récitations et corrections en SQL.

---

## 🚀 Prochaines Étapes (Backlog)
1. **Mode Karaoké** : Surlignage automatique du texte pendant la lecture audio ou l'enregistrement.
2. **Système de Gamification** : Calcul des streaks (jours consécutifs) et objectifs hebdomadaires.
3. **Optimisation Mobile** : Rendre le split-screen adaptatif pour tablettes et smartphones.
4. **Export PDF** : Générer un rapport de correction complet pour l'apprenant.
5. **Intégration IA** : Utilisation d'Ollama pour une pré-analyse automatique des erreurs de prononciation.

---
*Dernière mise à jour : 30 Avril 2026*
