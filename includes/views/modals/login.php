<!-- ============================================================
     MODAL DE CONNEXION (affiché au démarrage)
     ============================================================ -->
<div class="modal-overlay" id="loginModal">
    <div class="modal">
        <div class="modal__logo">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <circle cx="26" cy="26" r="24" stroke="#D4A847" stroke-width="1.5"/>
                <circle cx="26" cy="26" r="16" stroke="rgba(212,168,71,0.3)" stroke-width="1"/>
                <path d="M26 10 L26 42 M18 18 Q26 15 34 18 M18 26 Q26 23 34 26 M18 34 Q26 31 34 34"
                      stroke="#D4A847" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
            </svg>
        </div>
        <h2 class="modal__title">Qira'ah</h2>
        <p class="modal__subtitle">Plateforme de correction de récitation du Coran</p>

        <div class="form-group">
            <label class="form-label" for="loginUsername">Nom d'utilisateur</label>
            <input type="text" id="loginUsername" class="form-input" placeholder="ex : AbdAllah" maxlength="50" autocomplete="off">
        </div>

        <p class="form-label" style="margin-bottom: var(--space-sm);">Je suis :</p>
        <div class="role-selector">
            <button class="role-btn selected" data-role="learner" id="roleLearner">
                <div class="role-btn__icon">📖</div>
                <div class="role-btn__label">Apprenant</div>
            </button>
            <button class="role-btn" data-role="reviewer" id="roleReviewer">
                <div class="role-btn__icon">✍️</div>
                <div class="role-btn__label">Relecteur</div>
            </button>
        </div>

        <button class="btn btn--primary" id="btnLogin" style="width:100%; margin-top: var(--space-sm);">Entrer</button>

        <div class="divider-ornament" style="margin-top: var(--space-lg);">بسم الله</div>
    </div>
</div>
