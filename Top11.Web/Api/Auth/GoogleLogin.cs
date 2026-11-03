using Microsoft.AspNetCore.Authentication;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Auth
{
	public static class GoogleLogin
	{
		public class Endpoint : IEndpoint
		{
			public void MapEndpoint(IEndpointRouteBuilder app)
			{
				app.MapGet("api/auth/google-login", async (HttpContext context, string? returnUrl) =>
				{
					var redirectUri = IsLocalUrl(returnUrl) ? returnUrl! : "/";

					if (context.User.Identity!.IsAuthenticated)
					{
						context.Response.Redirect(redirectUri);
						return;
					}

					await context.ChallengeAsync("google", new AuthenticationProperties()
					{
						RedirectUri = redirectUri
					});
				});
			}

			// Захист від open redirect: тільки відносні шляхи цього сайту
			private static bool IsLocalUrl(string? url) =>
				!string.IsNullOrEmpty(url)
				&& url[0] == '/'
				&& (url.Length == 1 || (url[1] != '/' && url[1] != '\\'));
		}
	}
}
