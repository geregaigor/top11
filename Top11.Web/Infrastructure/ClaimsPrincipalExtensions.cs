using System.Security.Claims;

namespace Top11.Web.Infrastructure
{
	public static class ClaimsPrincipalExtensions
	{
		/// <summary>Id акаунта з cookie-автентифікації. Для ендпоінтів з RequireAuthorization claim завжди є.</summary>
		public static int GetAccountId(this ClaimsPrincipal user)
		{
			var value = user.FindFirst(Top11CookieAuthenticationDefaults.Top11IdClimeName)?.Value;
			return int.TryParse(value, out var id)
				? id
				: throw new UnauthorizedAccessException("Немає claim з id акаунта");
		}
	}
}
