package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type authClaims struct {
	Sub   string
	Email string
}

type tokenClaims struct {
	jwt.RegisteredClaims
	Email string `json:"email"`
}

type Authenticator struct {
	issuer  string
	keyfunc jwt.Keyfunc
}

type authenticator = Authenticator

func NewAuthenticator(supabaseURL string) (*Authenticator, error) {
	base := strings.TrimRight(supabaseURL, "/")
	base = strings.TrimSuffix(base, "/auth/v1")
	jwksURL := base + "/auth/v1/.well-known/jwks.json"
	kf, err := keyfunc.NewDefault([]string{jwksURL})
	if err != nil {
		return nil, err
	}
	return &Authenticator{
		issuer:  base + "/auth/v1",
		keyfunc: kf.Keyfunc,
	}, nil
}

func newAuthenticator(supabaseURL string) (*authenticator, error) {
	return NewAuthenticator(supabaseURL)
}

func (a *authenticator) verify(tokenString string) (*authClaims, error) {
	var claims tokenClaims
	token, err := jwt.ParseWithClaims(tokenString, &claims, a.keyfunc,
		jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithIssuer(a.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	if !uuidRegex.MatchString(claims.Subject) {
		return nil, errors.New("invalid sub: must be a uuid")
	}
	return &authClaims{
		Sub:   claims.Subject,
		Email: claims.Email,
	}, nil
}

func (a *authenticator) requireAuth(next func(w http.ResponseWriter, r *http.Request, claims *authClaims)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(authHeader, prefix) {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		tokenString := strings.TrimSpace(authHeader[len(prefix):])
		if tokenString == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		claims, err := a.verify(tokenString)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r, claims)
	}
}
