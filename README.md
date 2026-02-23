# 🍳 Cuisinothèque  

> **La bibliothèque numérique de vos recettes**  

  
![Python](https://img.shields.io/badge/Python-3.10-blue?logo=python&logoColor=white)  
![Django](https://img.shields.io/badge/Django-5.2.11-092E20?logo=django&logoColor=white)  
![Docker](https://img.shields.io/badge/Docker-Containerization-2496ED?logo=docker&logoColor=white)  
![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestration-326CE5?logo=kubernetes&logoColor=white)  
![GSAP](https://img.shields.io/badge/GSAP-Animations-88CE02?logo=greensock&logoColor=white)  
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-4B-C51A4A?logo=raspberrypi&logoColor=white)  
![Status](https://img.shields.io/badge/Status-En%20développement-orange)   


---

## ✨ Vision  
Cuisinothèque est une application web qui centralise toutes vos recettes de cuisine dans un espace unique, élégant et organisé.  
Fini les carnets éparpillés et les captures d’écran perdues : créez votre propre **hub culinaire** accessible depuis votre réseau local, et bientôt partageable avec vos proches.  

---

## 👥 Public cible  
- **Passionnés de cuisine** qui souhaitent conserver leurs créations.  
- **Familles** qui veulent un carnet culinaire commun.  
- **Curieux** qui aiment tester, modifier et garder une trace de leurs variantes.  

---

## 🔑 Fonctionnalités (MVP)  
- Ajouter, modifier et supprimer des recettes.  
- Classer les recettes (catégories, ingrédients, étapes).  
- Interface responsive et moderne.  
- Stockage local sécurisé (hébergement sur Raspberry Pi).  

---

## 🎨 Identité & expérience utilisateur  

**Nom** : *Cuisinothèque* (une bibliothèque culinaire moderne).  

### Charte graphique (version actuelle)

#### 1. Principes
- Interface douce, lisible, contrastee.
- Surfaces majoritairement en couleurs pleines.
- Effets interactifs coherents sur les boutons (hover avec logique de remplissage).
- Mode clair et mode sombre pilotes par variables globales.
- `linear-gradient` non utilise.

#### 2. Palette globale (tokens)
Mode clair :
- `--bg` : `#F3EFE8` (fond global)
- `--surface` : `#FFFFFF`
- `--surface-2` : `#FAF7F2` (surface de contraste douce)
- `--text` : `#353739` (charbon pastel)
- `--muted` : `rgba(53, 55, 57, 0.74)`
- `--border` : `#D8D8D8`
- `--primary` : `#8FBEA0` (vert)
- `--secondary` : `#6F97C6` (bleu)
- `--honey` : `#E9AB3A` (accent miel)
- `--vanilla` : `#F7D590` (accent vanille)

Mode sombre :
- `--bg` : `#161616`
- `--surface` : `#212121`
- `--surface-2` : `#1C1C1C`
- `--text` : `#D7DAE0`
- `--muted` : `rgba(215, 218, 224, 0.72)`
- `--border` : `rgba(230, 230, 230, 0.10)`
- `--primary` : `#7FB28F`
- `--secondary` : `#86A6CF`
- `--honey` : `#D9B86A`
- `--vanilla` : `#FFDFA3`

#### 3. Regles de surfaces (mode clair)
Meme fond (contraste, different du body), utilise `--surface-2` :
- Blocs parent formulaire : `Infos` + `Sections`
- Bouton theme (soleil/lune)
- Pills home : `📒`, `🧾`, `🧁`
- Cartes home : `Consulter`, `Ajouter`, `Organiser`

Fond aligne au body, utilise `--bg` :
- Petit bloc `Section` (dans le formulaire)
- Inputs + textareas
- Placeholders (teinte derivee)

#### 4. Typographie
- Texte principal via `--text`.
- Texte secondaire via `--muted`.
- Uniformisation globale pour eviter melange incoherent noir/blanc.
- Navbar conservee dans sa logique actuelle (pas de rupture visuelle).

#### 5. Boutons (systeme actuel)
Home :
- `Parcourir les recettes`
  - Clair : fond `#A6CDB3`, bordure `#78A488`, hover rempli `#78A488`
  - Sombre : fond `#5E876E`, bordure `#8EBA9F`, hover rempli `#8EBA9F`
- `Ajouter une recette`
  - Clair : fond `#9EBBDE`, bordure `#6D8FB9`, hover rempli `#6D8FB9`
  - Sombre : fond `#5F81AA`, bordure `#97B5DA`, hover rempli `#97B5DA`

Formulaire recette :
- `Ajouter une section` / `Enregistrer`
  - Clair : `#A6CDB3` + bordure `#78A488`
  - Sombre : `#5E876E` + bordure `#8EBA9F`
- `Ajouter ingredient` / `Ajouter etape`
  - Clair : vanille/miel (`--vanilla` / `--honey`)
  - Sombre : fond `#C8A75B`, bordure `#F1D595`, hover rempli `#F1D595`
- `Annuler`, `Supprimer`, boutons `✕`
  - Clair : fond `#F4F4F4`, bordure `#B9BDC4`, hover rempli `#C7CED7`
  - Sombre : fond `#B7C1CF`, bordure `#E7ECF3`, hover rempli `#E7ECF3`

Texte des boutons en sombre :
- Teinte actuelle : `#2C3035` (plus foncee, lisible sans etre agressive).

#### 6. Composants UI
- Bouton theme : format quasi carre, `40x40`, coins arrondis (`12px`), icone recentree.
- Cards globales : bordure visible + fond stable.
- Focus states : halo doux coherent avec le theme.

#### 7. Ton visuel final
- Mode clair : chaleureux, doux, contraste par surfaces `surface-2`.
- Mode sombre : propre, lisible, sans lumiere agressive, avec accents controles.

### Expérience utilisateur  
- Animations fluides avec [GSAP](https://greensock.com/gsap/)  
- Mode clair & sombre  

---

## 🛠️ Stack technique  
- **Back-end** : Django (Python)  
- **Front-end** : HTML / CSS / JS + GSAP  
- **CI/CD** : GitHub + GitHub Actions  
- **Conteneurisation** : Docker  
- **Orchestration** : Kubernetes  
- **Hébergement** : Raspberry Pi 4  

---

## 🚀 Ambitions futures  
- Recherche avancée (par ingrédient, temps de préparation, etc.).  
- Exportation / impression de carnets personnalisés.  

---

## 📚 Objectif d’apprentissage  
Ce projet est aussi un **terrain d’expérimentation** pour :  
- Approfondir Django et Python.  
- Découvrir et mettre en pratique Docker & Kubernetes.  
- Renforcer la sécurité d’une application web auto-hébergée.  
- Travailler l’UX/UI avec GSAP et une charte graphique cohérente.  

---

👉 *Cuisinothèque n’est pas seulement une application de gestion de recettes, c’est un projet qui combine apprentissage, design et plaisir culinaire.*  

---

## 📝 Licence

Ce projet est distribué sous licence **Licensed under PolyForm Noncommercial 1.0.0 Commercial use is strictly prohibited.**.

📄 Voir le fichier [LICENSE.md](LICENSE.md)  
🔗 [Lire la licence complète](https://polyformproject.org/licenses/noncommercial/1.0.0/)
